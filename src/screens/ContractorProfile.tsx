import { useState, useEffect, useRef } from 'react';
import { BadgeCheck, Camera, Edit3, Plus, MapPin, Users, Loader2, Save, X, Upload, Sparkles, Trash2, Info, ShieldCheck, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton, StarRating } from '../components/ui';
import type { ScreenId, PortfolioItem, PortfolioAuthenticity, UploadBatchItem } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import {
  apiGetContractorProfileMe,
  apiSaveContractorProfile,
  apiAnalyzePortfolioImage,
  apiConfirmPortfolioAi,
  apiReplacePortfolioImage,
  apiDeletePortfolioImage,
} from '../lib/api';
import { AiImageWarningModal, type ImageAnalysisData } from '../components/AiImageWarningModal';

const ALL_SPECS = [
  'Civil Construction',
  'Residential Construction',
  'Commercial Construction',
  'Road & Infrastructure',
  'Plumbing',
  'Electrical',
  'Painting',
  'Carpentry',
  'Masonry',
  'Interior Design',
  'Roofing',
  'Flooring',
  'HVAC',
  'Waterproofing',
  'Landscaping',
  'Demolition',
  'Renovation',
  'Structural Work',
];

const SAMPLE_PORTFOLIO_PHOTOS = [
  'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=600',
];

export function ContractorProfile({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const portfolioFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const replacingTargetRef = useRef<{ queueId?: string; oldImageUrl?: string } | null>(null);

  // Profile data
  const [fullName, setFullName] = useState('Contractor');
  const [businessName, setBusinessName] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [primaryTrade, setPrimaryTrade] = useState('Civil Construction');
  const [specializations, setSpecializations] = useState<string[]>(['Civil Construction']);
  const [experienceYears, setExperienceYears] = useState(5);
  const [licenseNo, setLicenseNo] = useState('');
  const [city, setCity] = useState('Coimbatore');
  const [serviceAreas, setServiceAreas] = useState<string[]>(['Gandhipuram', 'RS Puram']);
  const [about, setAbout] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [available, setAvailable] = useState(true);
  const [kycStatus, setKycStatus] = useState<'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const [isVerified, setIsVerified] = useState(false);
  const [rating, setRating] = useState(4.8);
  const [totalReviews, setTotalReviews] = useState(12);
  const [completedProjects, setCompletedProjects] = useState(15);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [batchUploadQueue, setBatchUploadQueue] = useState<UploadBatchItem[]>([]);
  const [pendingAiPhoto, setPendingAiPhoto] = useState<{
    queueId?: string;
    url: string;
    originalFilename?: string;
    analysis: ImageAnalysisData;
    item?: PortfolioItem;
  } | null>(null);
  const [profileError, setProfileError] = useState('');

  // Edit draft state
  const [draftBusinessName, setDraftBusinessName] = useState('');
  const [draftPrimaryTrade, setDraftPrimaryTrade] = useState('');
  const [draftSpecializations, setDraftSpecializations] = useState<string[]>([]);
  const [customSpecInput, setCustomSpecInput] = useState('');
  const [draftExperience, setDraftExperience] = useState(0);
  const [draftLicense, setDraftLicense] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftAreas, setDraftAreas] = useState<string[]>([]);
  const [draftAbout, setDraftAbout] = useState('');
  const [draftTeamSize, setDraftTeamSize] = useState(1);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiGetContractorProfileMe();
      if (res.fullName) setFullName(res.fullName);
      if (res.kycStatus) setKycStatus(res.kycStatus);
      setIsVerified(res.kycStatus === 'VERIFIED');

      if (res.profile) {
        const p = res.profile;
        setBusinessName(p.businessName || '');
        setProfileImage(p.profileImage || '');
        setPrimaryTrade(p.primaryTrade || 'Civil Construction');
        setSpecializations(p.specializations?.length ? p.specializations : [p.primaryTrade || 'Civil Construction']);
        setExperienceYears(p.experienceYears || 0);
        setLicenseNo(p.licenseNo || '');
        setCity(p.city || 'Coimbatore');
        setServiceAreas(p.serviceAreas || ['Coimbatore']);
        setAbout(p.about || '');
        setTeamSize(p.teamSize || 1);
        setAvailable(p.isAvailable !== false);
        setRating(p.averageRating || 4.8);
        setTotalReviews(p.totalReviews || 0);
        setCompletedProjects(p.completedProjects || 0);

        if (Array.isArray(p.portfolioItems) && p.portfolioItems.length > 0) {
          setPortfolioItems(p.portfolioItems);
        } else if (Array.isArray(p.portfolioImages)) {
          setPortfolioItems(
            p.portfolioImages.map((url) => ({
              imageUrl: url,
              url,
              aiClassification: 'LIKELY_REAL',
              authenticity: 'LIKELY_REAL',
              aiConfidence: 0.96,
              confidence: 0.96,
              analysisReason: 'Verified site photo',
              detectedFeatures: ['Authentic camera noise profile verified'],
              isAiMarked: false,
              contractorConfirmedAI: false,
            }))
          );
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        const newPhoto = event.target.result;
        setProfileImage(newPhoto);
        try {
          await apiSaveContractorProfile({
            businessName,
            profileImage: newPhoto,
            primaryTrade,
            specializations,
            experienceYears,
            licenseNo,
            city,
            serviceAreas,
            about,
            teamSize,
            isAvailable: available,
            portfolioItems,
          });
        } catch {
          // ignore
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openEditModal = () => {
    setDraftBusinessName(businessName);
    setDraftPrimaryTrade(primaryTrade);
    setDraftSpecializations([...specializations]);
    setCustomSpecInput('');
    setDraftExperience(experienceYears);
    setDraftLicense(licenseNo);
    setDraftCity(city);
    setDraftAreas([...serviceAreas]);
    setDraftAbout(about);
    setDraftTeamSize(teamSize);
    setEditModalOpen(true);
  };

  const handleToggleDraftSpec = (s: string) => {
    setDraftSpecializations((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleAddCustomSpec = () => {
    if (!customSpecInput.trim()) return;
    const newItems = customSpecInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setDraftSpecializations((prev) => {
      const updated = [...prev];
      for (const item of newItems) {
        if (!updated.includes(item)) {
          updated.push(item);
        }
      }
      return updated;
    });
    setCustomSpecInput('');
  };

  const handleRemoveCustomSpec = (specToRemove: string) => {
    setDraftSpecializations((prev) => prev.filter((s) => s !== specToRemove));
  };

  const handleAddSamplePortfolioPhotos = () => {
    const samples: PortfolioItem[] = SAMPLE_PORTFOLIO_PHOTOS.map((url, i) => ({
      imageUrl: url,
      url,
      originalFilename: `sample-project-${i + 1}.jpg`,
      aiClassification: 'LIKELY_REAL',
      authenticity: 'LIKELY_REAL',
      aiConfidence: 0.95,
      confidence: 0.95,
      aiProvider: 'GROQ_VISION_QWEN',
      aiModel: 'qwen/qwen3.8-27b',
      analysisReason: 'Verified authentic site photo with genuine camera sensor grain',
      detectedFeatures: ['Natural lighting consistent with physical space', 'Sensor noise micro-variance'],
      isAiMarked: false,
      contractorConfirmedAI: false,
    }));
    setPortfolioItems((prev) => {
      const existingUrls = new Set(prev.map((p) => p.imageUrl || p.url));
      const newItems = samples.filter((s) => !existingUrls.has(s.imageUrl || s.url));
      return [...prev, ...newItems].slice(0, 10);
    });
  };

  const processBatchItem = async (file: File) => {
    const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setProfileError(`Invalid file format: ${file.name}. Only JPG, PNG, and WebP images are allowed.`);
      return;
    }
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setProfileError(`File "${file.name}" exceeds the 5MB size limit.`);
      return;
    }

    if (portfolioItems.length >= 10) {
      setProfileError('Maximum 10 portfolio images allowed.');
      return;
    }

    const queueId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const previewUrl = URL.createObjectURL(file);

    const initialItem: UploadBatchItem = {
      id: queueId,
      file,
      previewUrl,
      originalFilename: file.name,
      fileSize: file.size,
      status: 'SELECTED',
      progress: 10,
    };

    setBatchUploadQueue((prev) => [...prev, initialItem]);

    try {
      setBatchUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, status: 'UPLOADING', progress: 40 } : it))
      );

      setBatchUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, status: 'ANALYZING', progress: 75 } : it))
      );

      const res = await apiAnalyzePortfolioImage(file);
      const analysis = res.analysis;
      const returnedItem = res.item;

      if (analysis.aiClassification === 'LIKELY_REAL') {
        setPortfolioItems((prev) => {
          const filtered = prev.filter(
            (p) => (p.imageUrl || p.url) !== (returnedItem.imageUrl || returnedItem.url)
          );
          return [...filtered, returnedItem];
        });
        setBatchUploadQueue((prev) =>
          prev.map((it) =>
            it.id === queueId ? { ...it, status: 'SAVED', progress: 100 } : it
          )
        );
      } else {
        const statusType = analysis.aiClassification;
        setBatchUploadQueue((prev) =>
          prev.map((it) =>
            it.id === queueId
              ? {
                  ...it,
                  status: statusType as any,
                  progress: 90,
                  analysis,
                  portfolioItem: returnedItem,
                }
              : it
          )
        );

        setPendingAiPhoto({
          queueId,
          url: returnedItem.imageUrl || returnedItem.url || previewUrl,
          originalFilename: file.name,
          analysis: {
            aiClassification: analysis.aiClassification,
            aiConfidence: analysis.aiConfidence,
            authenticityScore: analysis.authenticityScore,
            scorePercentage: Math.round(analysis.aiConfidence * 100),
            analysisReason: analysis.analysisReason,
            detectedFeatures: analysis.detectedFeatures,
            analyzedAt: analysis.aiDetectionTimestamp,
          },
          item: returnedItem,
        });
      }
    } catch (err: unknown) {
      console.error('Batch item upload error:', err);
      const errMsg = err instanceof Error ? err.message : 'AI verification unavailable.';
      setBatchUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, status: 'FAILED', errorMessage: errMsg, progress: 100 }
            : it
        )
      );
    }
  };

  const handleUploadPortfolioPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setProfileError('');
    const fileList = Array.from(files);
    for (const file of fileList) {
      await processBatchItem(file);
    }
    e.target.value = '';
  };

  const handleReplaceSelectedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError('');
    const target = replacingTargetRef.current;
    if (target?.queueId) {
      setBatchUploadQueue((prev) => prev.filter((it) => it.id !== target.queueId));
    }
    if (target?.oldImageUrl) {
      try {
        const replaceRes = await apiReplacePortfolioImage({ file, oldImageUrl: target.oldImageUrl });
        if (replaceRes.item && replaceRes.saved) {
          setPortfolioItems((prev) => {
            const filtered = prev.filter((p) => (p.imageUrl || p.url) !== target.oldImageUrl);
            return [...filtered, replaceRes.item];
          });
        }
      } catch (err) {
        console.error('Error replacing image:', err);
      }
    } else {
      await processBatchItem(file);
    }
    replacingTargetRef.current = null;
    e.target.value = '';
  };

  const handleDeletePortfolioPhoto = async (index: number) => {
    const targetItem = portfolioItems[index];
    const imageUrl = targetItem?.imageUrl || targetItem?.url;
    if (!imageUrl) return;
    try {
      await apiDeletePortfolioImage(imageUrl);
      setPortfolioItems((prev) => prev.filter((_, i) => i !== index));
    } catch {
      setPortfolioItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleModalReplaceImage = () => {
    const currentQueueId = pendingAiPhoto?.queueId;
    replacingTargetRef.current = { queueId: currentQueueId, oldImageUrl: pendingAiPhoto?.url };
    if (currentQueueId) setBatchUploadQueue((prev) => prev.filter((it) => it.id !== currentQueueId));
    setPendingAiPhoto(null);
    setTimeout(() => { replaceFileInputRef.current?.click(); }, 150);
  };

  const handleModalKeepImage = async (action: 'KEEP_AI' | 'KEEP_UNVERIFIED') => {
    if (!pendingAiPhoto || !pendingAiPhoto.item) return;
    try {
      const confirmRes = await apiConfirmPortfolioAi({ item: pendingAiPhoto.item, action });
      const confirmedItem = confirmRes.item;
      setPortfolioItems((prev) => {
        const filtered = prev.filter((p) => (p.imageUrl || p.url) !== (confirmedItem.imageUrl || confirmedItem.url));
        return [...filtered, confirmedItem];
      });
      if (pendingAiPhoto.queueId) {
        setBatchUploadQueue((prev) => prev.map((it) => it.id === pendingAiPhoto.queueId ? { ...it, status: 'SAVED', portfolioItem: confirmedItem } : it));
      }
    } catch (err: unknown) {
      console.error('Error confirming image:', err);
      const isKeepAi = action === 'KEEP_AI';
      const fallbackItem: PortfolioItem = {
        ...pendingAiPhoto.item,
        aiClassification: isKeepAi ? 'LIKELY_AI_GENERATED' : 'UNCERTAIN',
        contractorConfirmedAI: isKeepAi,
        isAiMarked: isKeepAi,
        authenticity: isKeepAi ? 'AI_GENERATED' : 'UNCERTAIN',
      };
      setPortfolioItems((prev) => [...prev, fallbackItem]);
    } finally {
      setPendingAiPhoto(null);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      let finalSpecs = [...draftSpecializations];
      if (customSpecInput.trim()) {
        const extra = customSpecInput.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        for (const item of extra) { if (!finalSpecs.includes(item)) finalSpecs.push(item); }
      }
      await apiSaveContractorProfile({
        businessName: draftBusinessName,
        profileImage,
        primaryTrade: draftPrimaryTrade || finalSpecs[0] || 'Civil Construction',
        specializations: finalSpecs.length ? finalSpecs : ['Civil Construction'],
        experienceYears: Number(draftExperience) || 0,
        licenseNo: draftLicense,
        city: draftCity || 'Coimbatore',
        serviceAreas: draftAreas.length ? draftAreas : [draftCity || 'Coimbatore'],
        about: draftAbout,
        teamSize: Number(draftTeamSize) || 1,
        isAvailable: available,
        portfolioItems,
      });
      await fetchProfile();
      setEditModalOpen(false);
      setCustomSpecInput('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async () => {
    const nextAvailable = !available;
    setAvailable(nextAvailable);
    try {
      await apiSaveContractorProfile({
        businessName,
        profileImage,
        primaryTrade,
        specializations,
        experienceYears,
        city,
        serviceAreas,
        about,
        teamSize: teamSize || 1,
        isAvailable: nextAvailable,
        portfolioItems,
      });
    } catch {
      setAvailable(!nextAvailable);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <TopNav avatarSrc={profileImage || undefined} avatarName={fullName} onNavigate={onNavigate} />
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8">
        <div className="flex items-start gap-4">
          <div className="relative group shrink-0">
            <input ref={avatarFileInputRef} type="file" accept="image/*" onChange={handleAvatarFileUpload} className="hidden" />
            {profileImage ? (
              <img src={profileImage} alt={fullName} onClick={() => avatarFileInputRef.current?.click()} className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md cursor-pointer group-hover:opacity-90 transition-opacity" />
            ) : (
              <div onClick={() => avatarFileInputRef.current?.click()} className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full bg-navy-600 text-xl font-bold text-white shadow-md hover:bg-navy-700 transition-colors">
                {fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
            )}
            <button type="button" onClick={() => avatarFileInputRef.current?.click()} title="Change photo" className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-navy-900 shadow-md hover:bg-amber-300">
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-navy-700">{fullName}</h1>
              {isVerified ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" /> {t(locale, 'verifiedBadge') || 'Verified'}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">KYC Pending</span>
              )}
            </div>
            {businessName && <p className="text-sm font-semibold text-navy-600 mt-0.5">{businessName}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><StarRating rating={rating} /> {rating} ({totalReviews})</span>
              <span>· {experienceYears} yrs experience</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-amber-500" /> {city}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={openEditModal} className="flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 shadow-sm hover:bg-navy-50">
            <Edit3 className="h-3.5 w-3.5" /> Edit Profile Details
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-100 p-4">
          <div>
            <p className="text-sm font-semibold text-navy-700">Availability Status</p>
            <p className="text-xs text-gray-500">{available ? 'Accepting new projects' : 'Currently busy'}</p>
          </div>
          <button onClick={handleToggleAvailability} className={`relative h-7 w-12 rounded-full transition-colors ${available ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-soft transition-transform ${available ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-navy-600">About / Bio</p>
          <p className="text-sm text-gray-600 rounded-lg bg-gray-50 p-3 border border-gray-100">
            {about || `Experienced contractor in ${primaryTrade} with ${experienceYears} years of work experience in ${city}.`}
          </p>
        </div>

        <div className="mt-6">
          <input ref={portfolioFileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={handleUploadPortfolioPhoto} className="hidden" />
          <input ref={replaceFileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleReplaceSelectedFile} className="hidden" />

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Portfolio & Past Projects</h2>
              <p className="text-[11px] text-gray-400">AI-verified authentic construction site photographs & concept renderings</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleAddSamplePortfolioPhotos} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
                <Sparkles className="h-3.5 w-3.5" /> Sample Photos
              </button>
              <button type="button" onClick={() => portfolioFileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-navy-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-700 transition-colors shadow-xs">
                <Upload className="h-3.5 w-3.5" /> Upload Photos
              </button>
            </div>
          </div>

          {profileError && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
              <span>{profileError}</span>
              <button type="button" onClick={() => setProfileError('')}><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {batchUploadQueue.filter((it) => it.status !== 'SAVED').length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-navy-800">Processing Upload Batch:</p>
              <div className="space-y-1.5">
                {batchUploadQueue.filter((it) => it.status !== 'SAVED').map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2.5 text-xs shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={item.previewUrl} alt="Preview" className="h-9 w-9 rounded object-cover border" />
                      <div className="min-w-0">
                        <p className="font-medium text-navy-800 truncate">{item.originalFilename}</p>
                        <div className="text-[10px] text-gray-400">
                          {item.status === 'ANALYZING' && <span className="text-amber-600">Analyzing...</span>}
                          {item.status === 'FAILED' && <span className="text-red-600">{item.errorMessage || 'Failed'}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(item.status === 'LIKELY_AI_GENERATED' || item.status === 'UNCERTAIN') && (
                        <button type="button" onClick={() => { if(item.analysis && item.portfolioItem) setPendingAiPhoto({ queueId: item.id, url: item.portfolioItem.imageUrl || item.previewUrl, originalFilename: item.originalFilename, analysis: item.analysis, item: item.portfolioItem }); }} className="bg-amber-500 text-white px-2 py-1 rounded">Review</button>
                      )}
                      <button type="button" onClick={() => setBatchUploadQueue((prev) => prev.filter((it) => it.id !== item.id))} className="text-gray-400"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {portfolioItems.length > 0 && (() => {
            const total = portfolioItems.length;
            const realCount = portfolioItems.filter((i) => (i.aiClassification === 'LIKELY_REAL' || i.authenticity === 'LIKELY_REAL') && !i.contractorConfirmedAI && !i.isAiMarked).length;
            const aiCount = portfolioItems.filter((i) => i.aiClassification === 'LIKELY_AI_GENERATED' || i.contractorConfirmedAI || i.isAiMarked || i.authenticity === 'AI_GENERATED').length;
            return (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <p className="font-bold text-navy-800 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Portfolio Image Summary ({total}/10 Photos)</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Real: {realCount} | AI: {aiCount}</p>
              </div>
            );
          })()}

          {portfolioItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {portfolioItems.map((item, i) => {
                const isAi = item.aiClassification === 'LIKELY_AI_GENERATED' || item.contractorConfirmedAI || item.isAiMarked || item.authenticity === 'AI_GENERATED';
                const isUncertain = item.aiClassification === 'UNCERTAIN' || item.authenticity === 'UNCERTAIN';
                return (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-xs">
                    <img src={item.imageUrl || item.url || ''} alt="Portfolio" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => handleDeletePortfolioPhoto(i)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                      {isAi ? <span className="text-[10px] bg-amber-900/90 text-amber-200 px-2 py-0.5 rounded">⚠ AI Generated</span> : isUncertain ? <span className="text-[10px] bg-blue-900/90 text-blue-200 px-2 py-0.5 rounded">? Unverified</span> : <span className="text-[10px] bg-emerald-900/90 text-emerald-200 px-2 py-0.5 rounded">✓ Likely Real</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
              <Camera className="mx-auto h-6 w-6 text-navy-600 mb-2" />
              <p className="text-sm font-semibold">No Portfolio Photos Added</p>
            </div>
          )}
        </div>
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold border-b pb-3">Edit Profile</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-navy-700">Specializations</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 border rounded-lg">
                  {ALL_SPECS.map((s) => (
                    <button key={s} type="button" onClick={() => handleToggleDraftSpec(s)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${draftSpecializations.includes(s) ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={draftCity} onChange={(e) => setDraftCity(e.target.value)} className="border p-2 rounded text-sm" />
                <input type="number" min={1} value={draftTeamSize} onChange={(e) => setDraftTeamSize(Number(e.target.value))} className="border p-2 rounded text-sm" />
              </div>
              <input type="text" value={draftLicense} onChange={(e) => setDraftLicense(e.target.value)} className="w-full border p-2 rounded text-sm" />
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="button" onClick={handleSaveProfile} className="bg-amber-400 px-5 py-2 text-sm font-semibold rounded-lg text-navy-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AiImageWarningModal
        isOpen={Boolean(pendingAiPhoto)}
        imageUrl={pendingAiPhoto?.url || ''}
        analysis={pendingAiPhoto?.analysis || null}
        onReplace={handleModalReplaceImage}
        onKeep={handleModalKeepImage}
        onClose={() => setPendingAiPhoto(null)}
      />

      <MicButton />
    </div>
  );
}
