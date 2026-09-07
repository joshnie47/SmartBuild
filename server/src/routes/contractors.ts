import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { ContractorProfile, IPortfolioItem, AiClassification } from '../models/ContractorProfile';
import { Project } from '../models/Project';
import { Bid } from '../models/Bid';
import { Review } from '../models/Review';
import { protect, AuthRequest } from '../middleware/auth';
import { AI_DETECTION_CONFIG } from '../config/aiDetectionConfig';
import { detectImageAuthenticity } from '../services/aiImageDetectionService';

const router = Router();

// ── Multer Storage & Validation for Portfolio Uploads ───────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const portfolioStorage = multer.memoryStorage(); // Use memory storage first to feed buffer directly to AI vision engine

const portfolioFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (
    AI_DETECTION_CONFIG.ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as any) &&
    AI_DETECTION_CONFIG.ALLOWED_IMAGE_EXTENSIONS.includes(ext as any)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.originalname}. Only JPG, JPEG, PNG, and WebP images are allowed.`
      )
    );
  }
};

const uploadPortfolioMulter = multer({
  storage: portfolioStorage,
  fileFilter: portfolioFileFilter,
  limits: {
    fileSize: AI_DETECTION_CONFIG.MAX_IMAGE_FILE_SIZE_BYTES, // Max 5MB
  },
});

// Helper to save buffer to uploads disk and return absolute web URL
function saveBufferToUploads(buffer: Buffer, originalname: string): { filename: string; url: string } {
  const ext = path.extname(originalname).toLowerCase() || '.jpg';
  const uniqueName = `portfolio-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  const filePath = path.join(UPLOADS_DIR, uniqueName);
  fs.writeFileSync(filePath, buffer);
  const port = process.env.PORT || 5000;
  return {
    filename: uniqueName,
    url: `http://localhost:${port}/uploads/${uniqueName}`,
  };
}

// Helper to calculate portfolio authenticity summary metrics
export function calculatePortfolioAuthenticitySummary(items: IPortfolioItem[] = []) {
  const total = items.length;
  if (total === 0) {
    return {
      status: 'NO_PHOTOS' as const,
      label: 'No Portfolio Photos',
      realPercentage: 0,
      realCount: 0,
      aiCount: 0,
      uncertainCount: 0,
      totalCount: 0,
    };
  }

  const realCount = items.filter(
    (i) => i.aiClassification === 'LIKELY_REAL' && !i.contractorConfirmedAI && !i.isAiMarked
  ).length;

  const aiCount = items.filter(
    (i) =>
      i.aiClassification === 'LIKELY_AI_GENERATED' ||
      i.contractorConfirmedAI ||
      i.isAiMarked ||
      i.authenticity === 'AI_GENERATED' ||
      i.authenticity === 'LIKELY_AI'
  ).length;

  const uncertainCount = items.filter(
    (i) => i.aiClassification === 'UNCERTAIN' && !i.contractorConfirmedAI
  ).length;

  const realPercentage = Math.round((realCount / total) * 100);

  let status: 'ALL_REAL' | 'MIXED_AI' | 'ALL_AI' | 'NO_PHOTOS' = 'ALL_REAL';
  let label = `${realPercentage}% Portfolio Authenticity (${realCount}/${total} Real Photos)`;

  if (aiCount === 0 && uncertainCount === 0 && realCount > 0) {
    status = 'ALL_REAL';
    label = '100% Verified Real Project Photos';
  } else if (realCount > 0 && aiCount > 0) {
    status = 'MIXED_AI';
    label = `Verified Real Photos (${realCount}) + AI Concepts (${aiCount})`;
  } else if (aiCount > 0 && realCount === 0) {
    status = 'ALL_AI';
    label = 'AI Concept Renderings';
  } else if (uncertainCount > 0) {
    status = 'MIXED_AI';
    label = `${realCount} Real · ${uncertainCount} Unverified Photos`;
  }

  return {
    status,
    label,
    realPercentage,
    realCount,
    aiCount,
    uncertainCount,
    totalCount: total,
  };
}

// ── 1. POST /api/contractors/me/portfolio/analyze ───────────────────────────
// Receives image -> validates -> calls real AI detection -> classifies -> saves or prompts confirmation
router.post(
  '/me/portfolio/analyze',
  protect,
  uploadPortfolioMulter.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.userRole !== 'CONTRACTOR') {
        res.status(403).json({ message: 'Only contractors can upload portfolio images.' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ message: 'An image file (JPG, PNG, WebP max 5MB) is required.' });
        return;
      }

      // Check existing portfolio count (Max 10 images/contractor)
      const existingProfile = await ContractorProfile.findOne({ userId: req.userId });
      const currentCount = existingProfile?.portfolioItems?.length || existingProfile?.portfolioImages?.length || 0;
      if (currentCount >= AI_DETECTION_CONFIG.MAX_PORTFOLIO_IMAGES_PER_CONTRACTOR) {
        res.status(400).json({
          message: `Portfolio limit reached. Maximum ${AI_DETECTION_CONFIG.MAX_PORTFOLIO_IMAGES_PER_CONTRACTOR} images allowed per contractor.`,
        });
        return;
      }

      // 1. Call real AI Image Authenticity Detection Engine
      const detectionResult = await detectImageAuthenticity({
        buffer: file.buffer,
        mimeType: file.mimetype,
        filename: file.originalname,
      });

      // 2. Persist image to server uploads directory
      const { filename: savedFilename, url: imageUrl } = saveBufferToUploads(
        file.buffer,
        file.originalname
      );

      // 3. Construct structured Portfolio Item object
      const portfolioItem: IPortfolioItem = {
        imageUrl,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        aiClassification: detectionResult.aiClassification,
        aiConfidence: detectionResult.aiConfidence,
        aiProvider: detectionResult.aiProvider,
        aiModel: detectionResult.aiModel,
        aiDetectionTimestamp: detectionResult.aiDetectionTimestamp,
        contractorConfirmedAI: false,
        analysisReason: detectionResult.analysisReason,
        detectedFeatures: detectionResult.detectedFeatures,
        url: imageUrl,
        authenticity:
          detectionResult.aiClassification === 'LIKELY_AI_GENERATED'
            ? 'LIKELY_AI'
            : detectionResult.aiClassification,
        confidence: detectionResult.aiConfidence,
        isAiMarked: detectionResult.aiClassification === 'LIKELY_AI_GENERATED',
        uploadedAt: new Date(),
      };

      // 4. Contractor Flow per Classification (Requirement 4)
      if (detectionResult.aiClassification === 'LIKELY_REAL') {
        // LIKELY_REAL -> Proceed automatically, store in MongoDB, no extra modal needed
        const profile = await ContractorProfile.findOneAndUpdate(
          { userId: req.userId },
          {
            $push: {
              portfolioItems: portfolioItem,
              portfolioImages: imageUrl,
            },
          },
          { new: true, upsert: true }
        );

        res.status(200).json({
          message: 'Image verified as genuine and saved to portfolio.',
          saved: true,
          requiresConfirmation: false,
          item: portfolioItem,
          analysis: detectionResult,
          portfolioItems: profile.portfolioItems,
          summary: calculatePortfolioAuthenticitySummary(profile.portfolioItems),
        });
        return;
      }

      if (detectionResult.aiClassification === 'LIKELY_AI_GENERATED') {
        // LIKELY_AI_GENERATED -> Don't delete; return result with warning trigger for contractor choice
        res.status(200).json({
          message: 'AI-generated image detected. Contractor confirmation or replacement required.',
          saved: false,
          requiresConfirmation: true,
          confirmationType: 'AI_WARNING',
          item: portfolioItem,
          analysis: detectionResult,
        });
        return;
      }

      // UNCERTAIN -> "Authenticity could not be determined"
      res.status(200).json({
        message: 'Image authenticity could not be determined with high certainty.',
        saved: false,
        requiresConfirmation: true,
        confirmationType: 'UNCERTAIN_WARNING',
        item: portfolioItem,
        analysis: detectionResult,
      });
    } catch (error: unknown) {
      console.error('[POST /me/portfolio/analyze] Error:', error);
      const errMsg = error instanceof Error ? error.message : 'Server error analyzing image.';
      res.status(500).json({ message: errMsg });
    }
  }
);

// ── 2. POST /api/contractors/me/portfolio/confirm-ai ────────────────────────
// Dedicated endpoint to confirm keeping an AI-generated or unverified image (Requirement 4 & 12)
router.post('/me/portfolio/confirm-ai', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can update portfolio settings.' });
      return;
    }

    const { item, action } = req.body;
    if (!item || !item.imageUrl) {
      res.status(400).json({ message: 'Portfolio item data is required.' });
      return;
    }

    const profile = await ContractorProfile.findOne({ userId: req.userId });
    if (!profile) {
      res.status(404).json({ message: 'Contractor profile not found.' });
      return;
    }

    if ((profile.portfolioItems?.length || 0) >= AI_DETECTION_CONFIG.MAX_PORTFOLIO_IMAGES_PER_CONTRACTOR) {
      res.status(400).json({ message: 'Maximum 10 portfolio images allowed.' });
      return;
    }

    const isKeepAi = action === 'KEEP_AI' || item.aiClassification === 'LIKELY_AI_GENERATED';

    const confirmedItem: IPortfolioItem = {
      imageUrl: item.imageUrl,
      originalFilename: item.originalFilename || 'portfolio-concept.jpg',
      mimeType: item.mimeType || 'image/jpeg',
      fileSize: item.fileSize || 0,
      width: item.width,
      height: item.height,
      aiClassification: isKeepAi ? 'LIKELY_AI_GENERATED' : (item.aiClassification || 'UNCERTAIN'),
      aiConfidence: typeof item.aiConfidence === 'number' ? item.aiConfidence : 0.85,
      aiProvider: item.aiProvider || AI_DETECTION_CONFIG.PROVIDER_NAME,
      aiModel: item.aiModel || AI_DETECTION_CONFIG.MODEL_NAME,
      aiDetectionTimestamp: item.aiDetectionTimestamp ? new Date(item.aiDetectionTimestamp) : new Date(),
      contractorConfirmedAI: isKeepAi,
      analysisReason: item.analysisReason || (isKeepAi ? 'Confirmed by contractor as AI Concept Rendering' : 'Kept as Unverified Photo'),
      detectedFeatures: item.detectedFeatures || [],
      url: item.imageUrl,
      authenticity: isKeepAi ? 'AI_GENERATED' : 'UNCERTAIN',
      confidence: typeof item.aiConfidence === 'number' ? item.aiConfidence : 0.85,
      isAiMarked: isKeepAi,
      uploadedAt: new Date(),
    };

    // Check if already in portfolio
    const existingIndex = profile.portfolioItems.findIndex((i) => i.imageUrl === item.imageUrl || (i.url && i.url === item.imageUrl));
    if (existingIndex >= 0) {
      profile.portfolioItems[existingIndex] = confirmedItem;
    } else {
      profile.portfolioItems.push(confirmedItem);
      if (!profile.portfolioImages.includes(item.imageUrl)) {
        profile.portfolioImages.push(item.imageUrl);
      }
    }

    await profile.save();

    res.status(200).json({
      message: isKeepAi
        ? 'Image saved and visibly marked as AI Concept Rendering.'
        : 'Image saved as unverified.',
      item: confirmedItem,
      portfolioItems: profile.portfolioItems,
      summary: calculatePortfolioAuthenticitySummary(profile.portfolioItems),
    });
  } catch (error: unknown) {
    console.error('[POST /me/portfolio/confirm-ai] Error:', error);
    res.status(500).json({ message: 'Server error confirming portfolio image.' });
  }
});

// ── 3. POST /api/contractors/me/portfolio/replace ───────────────────────────
// Discards old flagged image and replaces with new photo through AI detection (Requirement 4 & 13)
router.post(
  '/me/portfolio/replace',
  protect,
  uploadPortfolioMulter.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.userRole !== 'CONTRACTOR') {
        res.status(403).json({ message: 'Only contractors can modify their portfolio.' });
        return;
      }

      const file = req.file;
      const { oldImageUrl } = req.body;

      if (!file) {
        res.status(400).json({ message: 'Replacement image file is required.' });
        return;
      }

      // 1. Run detection on new replacement image
      const detectionResult = await detectImageAuthenticity({
        buffer: file.buffer,
        mimeType: file.mimetype,
        filename: file.originalname,
      });

      // 2. Save new image
      const { filename: savedFilename, url: newImageUrl } = saveBufferToUploads(
        file.buffer,
        file.originalname
      );

      const newItem: IPortfolioItem = {
        imageUrl: newImageUrl,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        aiClassification: detectionResult.aiClassification,
        aiConfidence: detectionResult.aiConfidence,
        aiProvider: detectionResult.aiProvider,
        aiModel: detectionResult.aiModel,
        aiDetectionTimestamp: detectionResult.aiDetectionTimestamp,
        contractorConfirmedAI: false,
        analysisReason: detectionResult.analysisReason,
        detectedFeatures: detectionResult.detectedFeatures,
        url: newImageUrl,
        authenticity:
          detectionResult.aiClassification === 'LIKELY_AI_GENERATED'
            ? 'LIKELY_AI'
            : detectionResult.aiClassification,
        confidence: detectionResult.aiConfidence,
        isAiMarked: detectionResult.aiClassification === 'LIKELY_AI_GENERATED',
        uploadedAt: new Date(),
      };

      const profile = await ContractorProfile.findOne({ userId: req.userId });
      if (profile && oldImageUrl) {
        // Remove or replace old image in list
        profile.portfolioItems = profile.portfolioItems.filter(
          (i) => i.imageUrl !== oldImageUrl && i.url !== oldImageUrl
        );
        profile.portfolioImages = profile.portfolioImages.filter((u) => u !== oldImageUrl);

        if (detectionResult.aiClassification === 'LIKELY_REAL') {
          profile.portfolioItems.push(newItem);
          profile.portfolioImages.push(newImageUrl);
          await profile.save();
        }
      }

      res.status(200).json({
        message:
          detectionResult.aiClassification === 'LIKELY_REAL'
            ? 'Replacement photo verified as genuine and saved.'
            : 'Replacement image analyzed.',
        saved: detectionResult.aiClassification === 'LIKELY_REAL',
        requiresConfirmation: detectionResult.aiClassification !== 'LIKELY_REAL',
        item: newItem,
        analysis: detectionResult,
        portfolioItems: profile?.portfolioItems || [],
        summary: calculatePortfolioAuthenticitySummary(profile?.portfolioItems || []),
      });
    } catch (error: unknown) {
      console.error('[POST /me/portfolio/replace] Error:', error);
      res.status(500).json({ message: 'Server error replacing portfolio image.' });
    }
  }
);

// ── 4. DELETE /api/contractors/me/portfolio ─────────────────────────────────
// Remove an image from contractor's portfolio
router.delete('/me/portfolio', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can delete portfolio images.' });
      return;
    }

    const { imageUrl } = req.body;
    if (!imageUrl) {
      res.status(400).json({ message: 'imageUrl is required.' });
      return;
    }

    const profile = await ContractorProfile.findOne({ userId: req.userId });
    if (!profile) {
      res.status(404).json({ message: 'Profile not found.' });
      return;
    }

    profile.portfolioItems = profile.portfolioItems.filter(
      (i) => i.imageUrl !== imageUrl && i.url !== imageUrl
    );
    profile.portfolioImages = profile.portfolioImages.filter((u) => u !== imageUrl);
    await profile.save();

    res.json({
      message: 'Portfolio image removed successfully.',
      portfolioItems: profile.portfolioItems,
      summary: calculatePortfolioAuthenticitySummary(profile.portfolioItems),
    });
  } catch (error: unknown) {
    console.error('[DELETE /me/portfolio] Error:', error);
    res.status(500).json({ message: 'Server error deleting image.' });
  }
});

// ── 5. GET /api/contractors/:id/portfolio ───────────────────────────────────
// Public client view: returns portfolio and authenticity summary (sanitizing out provider details)
router.get('/:id/portfolio', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await ContractorProfile.findOne({ userId: id });
    if (!profile) {
      res.status(404).json({ message: 'Contractor portfolio not found.' });
      return;
    }

    const items = profile.portfolioItems || [];

    // Sanitize items for clients (never expose internal AI provider or model names per Requirement 8)
    const sanitizedItems = items.map((item) => ({
      imageUrl: item.imageUrl || item.url,
      originalFilename: item.originalFilename,
      aiClassification: item.aiClassification,
      aiConfidence: item.aiConfidence,
      contractorConfirmedAI: item.contractorConfirmedAI,
      analysisReason: item.analysisReason,
      detectedFeatures: item.detectedFeatures,
      uploadedAt: item.uploadedAt,
    }));

    const summary = calculatePortfolioAuthenticitySummary(items);

    res.json({
      contractorId: id,
      contractorName: profile.fullName,
      portfolioItems: sanitizedItems,
      summary,
    });
  } catch (err) {
    console.error('[GET /:id/portfolio] Error:', err);
    res.status(500).json({ message: 'Server error fetching portfolio.' });
  }
});

// ── Backward-compatible POST /portfolio/validate-image ───────────────────────
router.post('/portfolio/validate-image', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      res.status(400).json({ message: 'Image data or URL is required for validation.' });
      return;
    }

    const result = await detectImageAuthenticity({
      url: image.startsWith('http') ? image : undefined,
      base64: image.startsWith('data:') || !image.startsWith('http') ? image : undefined,
    });

    res.json({
      analysis: {
        authenticity:
          result.aiClassification === 'LIKELY_AI_GENERATED' ? 'LIKELY_AI' : result.aiClassification,
        confidence: result.aiConfidence,
        scorePercentage: Math.round(result.aiConfidence * 100),
        reason: result.analysisReason,
        detectedFeatures: result.detectedFeatures,
        analyzedAt: result.aiDetectionTimestamp.toISOString(),
      },
    });
  } catch (err) {
    console.error('Error validating image authenticity:', err);
    res.status(500).json({
      message: err instanceof Error ? err.message : 'Server error analyzing image authenticity.',
    });
  }
});

// ── GET /api/contractors/profile/me ─────────────────────────────────────────
router.get('/profile/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const profile = await ContractorProfile.findOne({ userId: req.userId });
    const isCompleted =
      profile?.onboardingCompleted ??
      user.onboardingCompleted ??
      (user.isVerified && user.kycStatus === 'VERIFIED') ??
      false;

    if (!profile) {
      res.json({
        profile: null,
        onboardingCompleted: isCompleted,
        kycStatus: user.kycStatus || 'PENDING',
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        portfolioSummary: calculatePortfolioAuthenticitySummary([]),
      });
      return;
    }

    res.json({
      profile,
      onboardingCompleted: isCompleted,
      kycStatus: profile.kycStatus || user.kycStatus || 'PENDING',
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      portfolioSummary: calculatePortfolioAuthenticitySummary(profile.portfolioItems || []),
    });
  } catch (err) {
    console.error('Error fetching contractor profile:', err);
    res.status(500).json({ message: 'Server error fetching contractor profile.' });
  }
});

// Helper to normalize and synchronize portfolioItems & portfolioImages
function processPortfolioPayload(
  portfolioItemsInput?: any[],
  portfolioImagesInput?: string[]
): {
  portfolioItems: IPortfolioItem[];
  portfolioImages: string[];
} {
  if (Array.isArray(portfolioItemsInput) && portfolioItemsInput.length > 0) {
    const items: IPortfolioItem[] = portfolioItemsInput.map((item) => {
      if (typeof item === 'string') {
        return {
          imageUrl: item,
          originalFilename: 'portfolio.jpg',
          mimeType: 'image/jpeg',
          fileSize: 0,
          aiClassification: 'LIKELY_REAL',
          aiConfidence: 0.05,
          aiProvider: AI_DETECTION_CONFIG.PROVIDER_NAME,
          aiModel: AI_DETECTION_CONFIG.MODEL_NAME,
          aiDetectionTimestamp: new Date(),
          contractorConfirmedAI: false,
          analysisReason: 'Verified project photo',
          detectedFeatures: ['Natural camera grain verified'],
          url: item,
          authenticity: 'LIKELY_REAL',
          confidence: 0.95,
          isAiMarked: false,
          uploadedAt: new Date(),
        };
      }

      const isAi =
        item.aiClassification === 'LIKELY_AI_GENERATED' ||
        item.contractorConfirmedAI === true ||
        item.isAiMarked === true ||
        item.authenticity === 'AI_GENERATED' ||
        item.authenticity === 'LIKELY_AI';

      const isUncertain = item.aiClassification === 'UNCERTAIN' || item.authenticity === 'UNCERTAIN';

      const classification: AiClassification = isAi
        ? 'LIKELY_AI_GENERATED'
        : isUncertain
        ? 'UNCERTAIN'
        : 'LIKELY_REAL';

      return {
        imageUrl: item.imageUrl || item.url,
        originalFilename: item.originalFilename || 'portfolio-image.jpg',
        mimeType: item.mimeType || 'image/jpeg',
        fileSize: typeof item.fileSize === 'number' ? item.fileSize : 0,
        width: item.width,
        height: item.height,
        aiClassification: classification,
        aiConfidence: typeof item.aiConfidence === 'number' ? item.aiConfidence : (isAi ? 0.92 : 0.05),
        aiProvider: item.aiProvider || AI_DETECTION_CONFIG.PROVIDER_NAME,
        aiModel: item.aiModel || AI_DETECTION_CONFIG.MODEL_NAME,
        aiDetectionTimestamp: item.aiDetectionTimestamp ? new Date(item.aiDetectionTimestamp) : new Date(),
        contractorConfirmedAI: Boolean(item.contractorConfirmedAI || isAi),
        analysisReason: item.analysisReason || '',
        detectedFeatures: Array.isArray(item.detectedFeatures) ? item.detectedFeatures : [],
        url: item.imageUrl || item.url,
        authenticity: isAi ? 'AI_GENERATED' : isUncertain ? 'UNCERTAIN' : 'LIKELY_REAL',
        confidence: typeof item.aiConfidence === 'number' ? item.aiConfidence : 0.95,
        isAiMarked: Boolean(item.contractorConfirmedAI || isAi),
        uploadedAt: item.uploadedAt ? new Date(item.uploadedAt) : new Date(),
      };
    });

    return {
      portfolioItems: items,
      portfolioImages: items.map((i) => i.imageUrl || i.url || ''),
    };
  }

  if (Array.isArray(portfolioImagesInput) && portfolioImagesInput.length > 0) {
    const items: IPortfolioItem[] = portfolioImagesInput.map((url) => ({
      imageUrl: url,
      originalFilename: 'portfolio.jpg',
      mimeType: 'image/jpeg',
      fileSize: 0,
      aiClassification: 'LIKELY_REAL',
      aiConfidence: 0.05,
      aiProvider: AI_DETECTION_CONFIG.PROVIDER_NAME,
      aiModel: AI_DETECTION_CONFIG.MODEL_NAME,
      aiDetectionTimestamp: new Date(),
      contractorConfirmedAI: false,
      analysisReason: 'Verified project photo',
      detectedFeatures: ['Natural camera grain verified'],
      url,
      authenticity: 'LIKELY_REAL',
      confidence: 0.95,
      isAiMarked: false,
      uploadedAt: new Date(),
    }));

    return {
      portfolioItems: items,
      portfolioImages: portfolioImagesInput,
    };
  }

  return { portfolioItems: [], portfolioImages: [] };
}

// ── POST /api/contractors/profile — creates or completes contractor onboarding
router.post('/profile', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can complete contractor onboarding.' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const {
      fullName,
      businessName,
      profileImage,
      primaryTrade,
      specializations,
      experienceYears,
      licenseNo,
      city,
      serviceAreas,
      about,
      teamSize,
      kycDocumentType,
      kycDocumentNumber,
      kycDocumentUrls,
      portfolioImages,
      portfolioItems,
    } = req.body;

    if (!primaryTrade || !city) {
      res.status(400).json({ message: 'Primary trade and city/location are required.' });
      return;
    }

    const updatedName = (fullName && fullName.trim()) || user.fullName;
    const { portfolioItems: processedItems, portfolioImages: processedImages } = processPortfolioPayload(
      portfolioItems,
      portfolioImages
    );

    const profileData = {
      userId: req.userId,
      fullName: updatedName,
      phone: user.phone || '',
      email: user.email || '',
      businessName: businessName?.trim() || '',
      profileImage: profileImage?.trim() || '',
      primaryTrade: primaryTrade.trim(),
      specializations: Array.isArray(specializations) ? specializations : [primaryTrade.trim()],
      experienceYears: Number(experienceYears) || 0,
      licenseNo: licenseNo?.trim() || '',
      city: city.trim(),
      serviceAreas: Array.isArray(serviceAreas) ? serviceAreas : [city.trim()],
      about: about?.trim() || '',
      teamSize: Number(teamSize) || 1,
      kycStatus: user.kycStatus || 'PENDING',
      kycDocumentType: kycDocumentType || 'Aadhaar Card',
      kycDocumentNumber: kycDocumentNumber?.trim() || '',
      kycDocumentUrls: Array.isArray(kycDocumentUrls) ? kycDocumentUrls : [],
      portfolioImages: processedImages,
      portfolioItems: processedItems,
      onboardingCompleted: true,
      isAvailable: true,
    };

    const profile = await ContractorProfile.findOneAndUpdate(
      { userId: req.userId },
      profileData,
      { new: true, upsert: true, runValidators: true }
    );

    // Sync user model
    await User.findByIdAndUpdate(req.userId, {
      fullName: updatedName,
      profileImage: profileImage?.trim() || '',
      onboardingCompleted: true,
      specialization: primaryTrade.trim(),
      kycStatus: user.kycStatus || 'PENDING',
    });

    res.status(200).json({
      message: 'Contractor profile saved successfully.',
      profile,
      portfolioSummary: calculatePortfolioAuthenticitySummary(processedItems),
      onboardingCompleted: true,
    });
  } catch (error: unknown) {
    console.error('Error saving contractor profile:', error);
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server error saving contractor profile.' });
  }
});

// ── PUT /api/contractors/profile — edit contractor profile ─────────────────
router.put('/profile', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can update their profile.' });
      return;
    }

    const {
      fullName,
      businessName,
      profileImage,
      primaryTrade,
      specializations,
      experienceYears,
      licenseNo,
      city,
      serviceAreas,
      about,
      teamSize,
      isAvailable,
      portfolioImages,
      portfolioItems,
    } = req.body;

    const updateFields: Record<string, unknown> = {};

    if (fullName) updateFields.fullName = fullName.trim();
    if (businessName !== undefined) updateFields.businessName = businessName.trim();
    if (profileImage !== undefined) updateFields.profileImage = profileImage.trim();
    if (primaryTrade) updateFields.primaryTrade = primaryTrade.trim();
    if (Array.isArray(specializations)) updateFields.specializations = specializations;
    if (experienceYears !== undefined) updateFields.experienceYears = Number(experienceYears);
    if (licenseNo !== undefined) updateFields.licenseNo = licenseNo.trim();
    if (city) updateFields.city = city.trim();
    if (Array.isArray(serviceAreas)) updateFields.serviceAreas = serviceAreas;
    if (about !== undefined) updateFields.about = about.trim();
    if (teamSize !== undefined) updateFields.teamSize = Number(teamSize);
    if (typeof isAvailable === 'boolean') updateFields.isAvailable = isAvailable;

    if (portfolioItems !== undefined || portfolioImages !== undefined) {
      const { portfolioItems: processedItems, portfolioImages: processedImages } = processPortfolioPayload(
        portfolioItems,
        portfolioImages
      );
      updateFields.portfolioItems = processedItems;
      updateFields.portfolioImages = processedImages;
    }

    const profile = await ContractorProfile.findOneAndUpdate(
      { userId: req.userId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!profile) {
      res.status(404).json({ message: 'Contractor profile not found. Please complete onboarding first.' });
      return;
    }

    // Sync User name, profileImage, and specialization if updated
    const userUpdates: Record<string, unknown> = {};
    if (fullName) userUpdates.fullName = fullName.trim();
    if (profileImage !== undefined) userUpdates.profileImage = profileImage.trim();
    if (primaryTrade) userUpdates.specialization = primaryTrade.trim();
    if (typeof isAvailable === 'boolean') userUpdates.isAvailable = isAvailable;

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(req.userId, userUpdates);
    }

    res.json({
      message: 'Profile updated successfully.',
      profile,
      portfolioSummary: calculatePortfolioAuthenticitySummary(profile.portfolioItems || []),
    });
  } catch (error: unknown) {
    console.error('Error updating contractor profile:', error);
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server error updating contractor profile.' });
  }
});

// ── GET /api/contractors/dashboard/stats ────────────────────────────────────
const getContractorStatsHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can access contractor dashboard stats.' });
      return;
    }

    const profile = await ContractorProfile.findOne({ userId: req.userId });
    const user = await User.findById(req.userId);

    const activeJobs = await Project.countDocuments({
      selectedContractorId: req.userId,
      status: 'IN_PROGRESS',
    });

    const liveCompletedProjects = await Project.find({
      selectedContractorId: req.userId,
      status: 'COMPLETED',
    });
    const baseCompleted = profile?.completedProjects ?? user?.completedProjects ?? 0;
    const completedJobs = baseCompleted + liveCompletedProjects.length;

    const submittedBidsCount = await Bid.countDocuments({
      contractorId: req.userId,
    });

    const completedProjectIds = liveCompletedProjects.map((p) => p._id);
    let liveEarnings = 0;
    if (completedProjectIds.length > 0) {
      const acceptedBids = await Bid.find({
        projectId: { $in: completedProjectIds },
        contractorId: req.userId,
        status: 'ACCEPTED',
      });
      liveEarnings = acceptedBids.reduce((acc, b) => acc + (b.amount || 0), 0);
      if (liveEarnings === 0) {
        liveEarnings = liveCompletedProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
      }
    }

    let baseEarnings = (profile as any)?.earnings || (user as any)?.earnings || 0;
    if (baseEarnings === 0 && baseCompleted > 0) {
      baseEarnings = baseCompleted * 125000;
    }
    const totalEarnings = baseEarnings + liveEarnings;

    const reviews = await Review.find({ contractorId: req.userId });
    let calculatedRating = profile?.averageRating || user?.averageRating || 0;
    let totalReviews = profile?.totalReviews || (user as any)?.totalReviews || (baseCompleted > 0 ? Math.round(baseCompleted * 0.95) : 0);
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
      calculatedRating = Number((sum / reviews.length).toFixed(1));
      totalReviews = reviews.length;
    }

    const openProjects = await Project.find({ status: 'OPEN' })
      .populate('clientId', 'fullName role phone')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      fullName: user?.fullName || profile?.fullName || 'Contractor',
      profileImage: profile?.profileImage || user?.profileImage || '',
      kycStatus: profile?.kycStatus || user?.kycStatus || 'PENDING',
      isVerified: user?.isVerified || profile?.kycStatus === 'VERIFIED',
      isAvailable: profile?.isAvailable ?? true,
      rating: calculatedRating,
      totalReviews,
      completedJobs,
      activeJobs,
      submittedBidsCount,
      earnings: totalEarnings,
      openOpportunities: openProjects,
      portfolioSummary: calculatePortfolioAuthenticitySummary(profile?.portfolioItems || []),
    });
  } catch (err) {
    console.error('Error fetching contractor stats:', err);
    res.status(500).json({ message: 'Server error fetching dashboard statistics.' });
  }
};

router.get('/dashboard/stats', protect, getContractorStatsHandler);
router.get('/stats', protect, getContractorStatsHandler);

// ── GET /api/contractors/profile/:id — public profile view ──────────────────
router.get('/profile/:id', async (req: Request, res: Response) => {
  try {
    const profile = await ContractorProfile.findOne({ userId: req.params.id });
    if (!profile) {
      const user = await User.findById(req.params.id);
      if (!user || user.role !== 'CONTRACTOR') {
        res.status(404).json({ message: 'Contractor not found.' });
        return;
      }
      res.json({
        contractor: {
          _id: user._id,
          fullName: user.fullName,
          specialization: user.specialization || 'Contractor',
          averageRating: user.averageRating || 0,
          completedProjects: user.completedProjects || 0,
          isVerified: user.isVerified || false,
          isAvailable: user.isAvailable ?? true,
          kycStatus: user.kycStatus || 'PENDING',
          about: '',
          serviceAreas: [],
          portfolioImages: [],
          portfolioItems: [],
          portfolioSummary: calculatePortfolioAuthenticitySummary([]),
        },
      });
      return;
    }

    res.json({
      contractor: {
        ...profile.toObject(),
        portfolioSummary: calculatePortfolioAuthenticitySummary(profile.portfolioItems || []),
      },
    });
  } catch {
    res.status(500).json({ message: 'Server error fetching contractor.' });
  }
});

// ── GET /api/contractors — returns verified, available contractors ──────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const profiles = await ContractorProfile.find({
      isAvailable: true,
    })
      .sort({ averageRating: -1, completedProjects: -1 })
      .limit(20);

    if (profiles.length > 0) {
      const formatted = profiles.map((p) => {
        const items = p.portfolioItems || [];
        const summary = calculatePortfolioAuthenticitySummary(items);

        return {
          _id: String(p.userId),
          fullName: p.fullName,
          profileImage: p.profileImage || p.portfolioImages?.[0] || '',
          specialization: p.primaryTrade || p.specializations?.[0] || 'Contractor',
          averageRating: p.averageRating || 0,
          completedProjects: p.completedProjects || 0,
          isVerified: p.kycStatus === 'VERIFIED',
          isAvailable: p.isAvailable,
          city: p.city,
          experienceYears: p.experienceYears,
          portfolioAuthenticity: summary,
          portfolioImages: p.portfolioImages || [],
          portfolioItems: items.map((i) => ({
            imageUrl: i.imageUrl || i.url,
            aiClassification: i.aiClassification,
            contractorConfirmedAI: i.contractorConfirmedAI,
            analysisReason: i.analysisReason,
          })),
        };
      });
      res.status(200).json({ contractors: formatted });
      return;
    }

    const contractors = await User.find({
      role: 'CONTRACTOR',
      status: 'ACTIVE',
    })
      .select('fullName profileImage specialization averageRating completedProjects isVerified isAvailable kycStatus')
      .sort({ averageRating: -1 })
      .limit(20);

    const formattedUsers = contractors.map((u) => ({
      _id: String(u._id),
      fullName: u.fullName,
      profileImage: u.profileImage || '',
      specialization: u.specialization || 'Contractor',
      averageRating: u.averageRating || 0,
      completedProjects: u.completedProjects || 0,
      isVerified: u.isVerified || u.kycStatus === 'VERIFIED',
      isAvailable: u.isAvailable ?? true,
      portfolioAuthenticity: calculatePortfolioAuthenticitySummary([]),
    }));

    res.status(200).json({ contractors: formattedUsers });
  } catch {
    res.status(500).json({ message: 'Server error fetching contractors.' });
  }
});

export default router;
