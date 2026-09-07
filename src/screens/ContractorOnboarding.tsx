import { useState, useRef } from 'react';
import { ArrowRight, ArrowLeft, Upload, Check, Clock, ShieldCheck, MapPin, Users, Loader2, Plus, X, Camera, Sparkles, Info, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import type { ScreenId, PortfolioItem, PortfolioAuthenticity, UploadBatchItem } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiSaveContractorProfile, apiValidatePortfolioImage, apiAnalyzePortfolioImage, apiConfirmPortfolioAi } from '../lib/api';
import { AiImageWarningModal, type ImageAnalysisData } from '../components/AiImageWarningModal';

const SPECIALIZATIONS = [
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

const SERVICE_AREAS = ['Coimbatore', 'Gandhipuram', 'RS Puram', 'Peelamedu', 'Saravanampatti', 'Singanallur', 'Kovaipudur', 'Sundarapuram'];

const SAMPLE_PORTFOLIO_PHOTOS = [
  'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=600',
];

export function ContractorOnboarding({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { locale } = useLocale();
  const [step, setStep] = useState(1);

  // Form states
  const [businessName, setBusinessName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [years, setYears] = useState(5);
  const [licenseNo, setLicenseNo] = useState('');
  const [specs, setSpecs] = useState<string[]>(['Civil Construction', 'Masonry']);
  const [otherSpecInput, setOtherSpecInput] = useState('');
  const [city, setCity] = useState('Coimbatore');
  const [areas, setAreas] = useState<string[]>(['Gandhipuram', 'RS Puram']);
  const [teamSize, setTeamSize] = useState(4);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [batchUploadQueue, setBatchUploadQueue] = useState<UploadBatchItem[]>([]);
  const [pendingAiPhoto, setPendingAiPhoto] = useState<{
    queueId?: string;
    url: string;
    originalFilename?: string;
    analysis: ImageAnalysisData;
    item?: PortfolioItem;
  } | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const replacingQueueIdRef = useRef<string | null>(null);
  const profilePhotoFileInputRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState('Aadhaar Card');
  const [docNumber, setDocNumber] = useState('');
  const [uploadedDocNames, setUploadedDocNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleSpec = (s: string) => setSpecs((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const toggleArea = (a: string) => setAreas((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));

  const handleProfilePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        setProfilePhoto(event.target.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddOtherSpec = () => {
    if (!otherSpecInput.trim()) return;
    const items = otherSpecInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setSpecs((prev) => {
      const next = [...prev];
      for (const item of items) {
        if (!next.includes(item)) next.push(item);
      }
      return next;
    });
    setOtherSpecInput('');
  };

  // Process a single file independently through the upload + AI verification pipeline
  const processBatchItem = async (file: File) => {
    // 1. Separate Frontend File Validation
    const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`Invalid file format: ${file.name}. Only JPG, PNG, and WebP images are allowed.`);
      return;
    }
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      setError(`File "${file.name}" exceeds the 5MB size limit.`);
      return;
    }

    if (portfolioItems.length >= 10) {
      setError('Maximum 10 portfolio images allowed.');
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
      // Step: UPLOADING
      setBatchUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, status: 'UPLOADING', progress: 40 } : it))
      );

      // Step: ANALYZING (Call real AI detection)
      setBatchUploadQueue((prev) =>
        prev.map((it) => (it.id === queueId ? { ...it, status: 'ANALYZING', progress: 75 } : it))
      );

      const res = await apiAnalyzePortfolioImage(file);
      const analysis = res.analysis;
      const returnedItem = res.item;

      if (analysis.aiClassification === 'LIKELY_REAL') {
        // Automatically save
        setPortfolioItems((prev) => [...prev, returnedItem]);
        setBatchUploadQueue((prev) =>
          prev.map((it) =>
            it.id === queueId
              ? {
                  ...it,
                  status: 'SAVED',
                  progress: 100,
                  analysis,
                  portfolioItem: returnedItem,
                }
              : it
          )
        );
      } else {
        // Flagged as LIKELY_AI_GENERATED or UNCERTAIN -> Prompt contractor choice
        const statusType = analysis.aiClassification;
        setBatchUploadQueue((prev) =>
          prev.map((it) =>
            it.id === queueId
              ? {
                  ...it,
                  status: statusType,
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
      console.error('Batch item error:', err);
      const errMsg = err instanceof Error ? err.message : 'AI verification temporarily unavailable.';
      setBatchUploadQueue((prev) =>
        prev.map((it) =>
          it.id === queueId
            ? { ...it, status: 'FAILED', errorMessage: errMsg, progress: 100 }
            : it
        )
      );
    }
  };

  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError('');

    const fileList = Array.from(files);
    // Process each image in batch independently
    for (const file of fileList) {
      await processBatchItem(file);
    }
    e.target.value = '';
  };

  const handleReplaceSelectedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    const targetQueueId = replacingQueueIdRef.current;
    if (targetQueueId) {
      // Remove old queue item
      setBatchUploadQueue((prev) => prev.filter((it) => it.id !== targetQueueId));
      replacingQueueIdRef.current = null;
    }
    await processBatchItem(file);
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPortfolioItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Flowchart Choice 1: Replace Image
  const handleModalReplaceImage = () => {
    const currentQueueId = pendingAiPhoto?.queueId;
    if (currentQueueId) {
      replacingQueueIdRef.current = currentQueueId;
      setBatchUploadQueue((prev) => prev.filter((it) => it.id !== currentQueueId));
    }
    setPendingAiPhoto(null);
    setTimeout(() => {
      replaceFileInputRef.current?.click();
    }, 150);
  };

  // Flowchart Choice 2: Keep Image (Mark as AI-Generated or Unverified)
  const handleModalKeepImage = async (action: 'KEEP_AI' | 'KEEP_UNVERIFIED') => {
    if (!pendingAiPhoto || !pendingAiPhoto.item) return;

    try {
      const confirmRes = await apiConfirmPortfolioAi({
        item: pendingAiPhoto.item,
        action,
      });

      const confirmedItem = confirmRes.item;
      setPortfolioItems((prev) => {
        const filtered = prev.filter(
          (p) => (p.imageUrl || p.url) !== (confirmedItem.imageUrl || confirmedItem.url)
        );
        return [...filtered, confirmedItem];
      });

      if (pendingAiPhoto.queueId) {
        setBatchUploadQueue((prev) =>
          prev.map((it) =>
            it.id === pendingAiPhoto.queueId
              ? {
                  ...it,
                  status: 'SAVED',
                  portfolioItem: confirmedItem,
                }
              : it
          )
        );
      }
    } catch (err: unknown) {
      console.error('Error confirming image:', err);
      // Fallback local persistence
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

  const handleSimulateDocUpload = (label: string) => {
    if (!uploadedDocNames.includes(label)) {
      setUploadedDocNames((prev) => [...prev, label]);
    }
  };

  const handleSubmitOnboarding = async () => {
    setLoading(true);
    setError('');
    try {
      let finalSpecs = [...specs];
      if (otherSpecInput.trim()) {
        const extra = otherSpecInput
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const item of extra) {
          if (!finalSpecs.includes(item)) finalSpecs.push(item);
        }
      }

      const photoUrls: string[] = portfolioItems
        .map((item) => item.imageUrl || item.url || '')
        .filter((u): u is string => Boolean(u));

      await apiSaveContractorProfile({
        businessName: businessName.trim() || 'Contractor Services',
        profileImage: profilePhoto.trim() || undefined,
        primaryTrade: finalSpecs[0] || 'Civil Construction',
        specializations: finalSpecs.length ? finalSpecs : ['Civil Construction'],
        experienceYears: Number(years) || 0,
        licenseNo: licenseNo.trim(),
        city: city.trim() || 'Coimbatore',
        serviceAreas: areas.length ? areas : [city.trim() || 'Coimbatore'],
        about: `Professional contractor providing quality ${specs.join(', ')} services in ${city}.`,
        teamSize: Number(teamSize) || 1,
        kycDocumentType: docType,
        kycDocumentNumber: docNumber.trim() || 'DOC-VERIFY-2026',
        kycDocumentUrls: [
          'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
        ],
        portfolioImages: photoUrls,
        portfolioItems: portfolioItems,
      });

      onNavigate('contractor-dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save onboarding details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav showSearch={false} avatarSrc={profilePhoto || undefined} avatarName="New Contractor" onNavigate={onNavigate} />
      <div className="mx-auto max-w-lg px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-bold text-navy-700">{t(locale, 'contractorOnboardingTitle') || 'Contractor Onboarding'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t(locale, 'contractorOnboardingSubtitle') || 'Complete your profile to start receiving job matches.'}
        </p>

        {/* Progress dots */}
        <div className="mt-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  s < step
                    ? 'bg-emerald-500 text-white'
                    : s === step
                    ? 'bg-navy-600 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {s < step ? <Check className="h-4 w-4" strokeWidth={3} /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 flex-1 rounded ${
                    s < step ? 'bg-emerald-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Step 1: Business details */}
        {step === 1 && (
          <div className="mt-6 animate-fadeIn space-y-4">
            {/* Profile Photo (Optional) */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-navy-700" />
                  <label className="text-sm font-semibold text-navy-700">Profile Photo</label>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                  Optional
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <div className="relative group shrink-0">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="Profile preview"
                      className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-100 text-navy-600 border-2 border-dashed border-gray-300">
                      <Camera className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => profilePhotoFileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-navy-600 text-white shadow-soft hover:bg-navy-700 transition-transform hover:scale-105"
                    title="Upload photo"
                  >
                    <Upload className="h-3 w-3" />
                  </button>
                  <input
                    ref={profilePhotoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoFile}
                    className="hidden"
                  />
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => profilePhotoFileInputRef.current?.click()}
                      className="rounded-lg bg-navy-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-700 transition-colors shadow-xs"
                    >
                      Choose Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfilePhoto('https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300')}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Use Sample
                    </button>
                    {profilePhoto && (
                      <button
                        type="button"
                        onClick={() => setProfilePhoto('')}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400 leading-tight">
                    Optional: Upload now or skip and set it later from your profile using the camera icon.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">
                {t(locale, 'businessName') || 'Business Name'}
              </label>
              <input
                placeholder="e.g. Kumar Civil & Construction Works"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">
                  {t(locale, 'yearsInBusiness') || 'Years in Business'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none focus:border-navy-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">
                  {t(locale, 'licenseNo') || 'License No. (Optional)'}
                </label>
                <input
                  placeholder="TN-CIVIL-2024"
                  value={licenseNo}
                  onChange={(e) => setLicenseNo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy-600">
                {t(locale, 'specializations') || 'Specializations / Construction Domain'}
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpec(s)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      specs.includes(s)
                        ? 'border-navy-600 bg-navy-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Other Specializations input box */}
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-navy-600">
                  Other Specializations (if not listed above)
                </label>
                <div className="flex gap-2">
                  <input
                    placeholder="e.g. Solar Installation, False Ceiling, Glass Work"
                    value={otherSpecInput}
                    onChange={(e) => setOtherSpecInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOtherSpec();
                      }
                    }}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-navy-700 placeholder-gray-400 outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddOtherSpec}
                    className="flex items-center gap-1 rounded-lg bg-navy-600 px-3 py-2 text-xs font-medium text-white hover:bg-navy-700 transition-colors shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-gray-400">
                  Type custom domain and click Add or press Enter (supports comma-separated values).
                </p>

                {specs.filter((s) => !SPECIALIZATIONS.includes(s)).length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase mr-1">Other Added:</span>
                    {specs
                      .filter((s) => !SPECIALIZATIONS.includes(s))
                      .map((customSpec) => (
                        <span
                          key={customSpec}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 text-xs font-medium"
                        >
                          <span>{customSpec}</span>
                          <button
                            type="button"
                            onClick={() => toggleSpec(customSpec)}
                            className="rounded-full p-0.5 hover:bg-amber-200 text-amber-700 transition-colors"
                            title="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: KYC */}
        {step === 2 && (
          <div className="mt-6 animate-fadeIn space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-amber-600">
                {t(locale, 'kycSecurityNote') || 'Your documents are encrypted and securely stored for Admin KYC.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none"
                >
                  <option>Aadhaar Card</option>
                  <option>PAN Card</option>
                  <option>Contractor License</option>
                  <option>GST Certificate</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">Document / ID Number</label>
                <input
                  placeholder="e.g. 5432-8765-9012"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none"
                />
              </div>
            </div>

            {[
              { label: 'Aadhaar Card', desc: 'Front and back' },
              { label: 'PAN Card', desc: 'Both sides' },
              { label: 'Contractor License', desc: 'Valid license copy' },
            ].map((doc) => {
              const isUploaded = uploadedDocNames.includes(doc.label);
              return (
                <div key={doc.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium text-navy-600">{doc.label}</label>
                    {isUploaded && <span className="text-xs font-semibold text-emerald-600">✓ Uploaded</span>}
                  </div>
                  <div
                    onClick={() => handleSimulateDocUpload(doc.label)}
                    className={`flex h-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                      isUploaded
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-gray-200 hover:border-navy-300 hover:bg-navy-50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <Upload className={`h-5 w-5 ${isUploaded ? 'text-emerald-500' : ''}`} />
                      <span className="text-xs text-gray-500">{doc.desc} — click to attach</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-500">
                Initial KYC Status: <span className="font-medium text-amber-600">Pending Review</span>
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Service areas & Team */}
        {step === 3 && (
          <div className="mt-6 animate-fadeIn space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Base City</label>
              <input
                placeholder="Coimbatore"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-navy-600">Service Areas Covered</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_AREAS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleArea(a)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      areas.includes(a)
                        ? 'border-navy-600 bg-navy-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <MapPin className="h-3 w-3" /> {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Team Size</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTeamSize(Math.max(1, teamSize - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="flex items-center gap-1.5 text-lg font-semibold text-navy-700">
                  <Users className="h-5 w-5 text-gray-400" /> {teamSize} members
                </span>
                <button
                  type="button"
                  onClick={() => setTeamSize(teamSize + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Portfolio Photos Section (Optional) */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-navy-700" />
                  <label className="text-sm font-semibold text-navy-700">
                    Portfolio & Past Work Photos
                  </label>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                  Optional — Upload now or later
                </span>
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Upload photos of your past construction or renovation projects to showcase your expertise. If you don't have photos ready right now, you can skip and add them anytime later from your profile.
              </p>

              <input
                ref={photoFileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={handlePhotoFiles}
                className="hidden"
              />

              <input
                ref={replaceFileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleReplaceSelectedFile}
                className="hidden"
              />

              {/* Upload action buttons */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => photoFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3.5 py-2 text-xs font-semibold text-navy-700 shadow-xs hover:bg-navy-50 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5 text-navy-600" /> Upload Photos (Max 10, 5MB each)
                </button>
                <span className="text-[11px] text-gray-400">
                  Formats: JPG, PNG, WebP
                </span>
              </div>

              {/* Active Batch Upload Queue items with states (Requirement 9 & 10) */}
              {batchUploadQueue.filter((it) => it.status !== 'SAVED').length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-navy-800">Processing Upload Batch:</p>
                  <div className="space-y-1.5">
                    {batchUploadQueue
                      .filter((it) => it.status !== 'SAVED')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2.5 text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={item.previewUrl}
                              alt="Upload preview"
                              className="h-9 w-9 rounded object-cover border border-gray-200"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-navy-800 truncate max-w-[180px]">
                                {item.originalFilename}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                <span>{(item.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                                <span>·</span>
                                {item.status === 'SELECTED' && <span>Selected</span>}
                                {item.status === 'UPLOADING' && <span>Uploading to server...</span>}
                                {item.status === 'ANALYZING' && (
                                  <span className="text-amber-600 font-medium flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Analyzing image authenticity...
                                  </span>
                                )}
                                {item.status === 'LIKELY_AI_GENERATED' && (
                                  <span className="text-amber-600 font-semibold">⚠ AI-Generated Flagged</span>
                                )}
                                {item.status === 'UNCERTAIN' && (
                                  <span className="text-blue-600 font-semibold">? Uncertain Authenticity</span>
                                )}
                                {item.status === 'FAILED' && (
                                  <span className="text-red-600 font-medium">{item.errorMessage || 'Failed'}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {(item.status === 'LIKELY_AI_GENERATED' || item.status === 'UNCERTAIN') && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.analysis && item.portfolioItem) {
                                    setPendingAiPhoto({
                                      queueId: item.id,
                                      url: item.portfolioItem.imageUrl || item.previewUrl,
                                      originalFilename: item.originalFilename,
                                      analysis: item.analysis,
                                      item: item.portfolioItem,
                                    });
                                  }
                                }}
                                className="rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2.5 py-1 text-[11px] shadow-xs"
                              >
                                Review Choices
                              </button>
                            )}

                            {item.status === 'FAILED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBatchUploadQueue((prev) => prev.filter((it) => it.id !== item.id));
                                  if (item.file) processBatchItem(item.file);
                                }}
                                className="rounded-md bg-navy-600 text-white px-2.5 py-1 text-[11px]"
                              >
                                Retry
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setBatchUploadQueue((prev) => prev.filter((it) => it.id !== item.id))}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Dismiss"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Portfolio Authenticity Summary & Metrics (Requirement 6 & 8) */}
              {portfolioItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {(() => {
                    const total = portfolioItems.length;
                    const realCount = portfolioItems.filter(
                      (i) => (i.aiClassification === 'LIKELY_REAL' || i.authenticity === 'LIKELY_REAL') &&
                             !i.contractorConfirmedAI && !i.isAiMarked
                    ).length;
                    const aiCount = portfolioItems.filter(
                      (i) => i.aiClassification === 'LIKELY_AI_GENERATED' ||
                             i.contractorConfirmedAI ||
                             i.isAiMarked ||
                             i.authenticity === 'AI_GENERATED' ||
                             i.authenticity === 'LIKELY_AI'
                    ).length;
                    const uncertainCount = portfolioItems.filter(
                      (i) => i.aiClassification === 'UNCERTAIN' || i.authenticity === 'UNCERTAIN'
                    ).length;
                    const realPct = total > 0 ? Math.round((realCount / total) * 100) : 0;

                    return (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-navy-800 text-xs flex items-center gap-1.5">
                              <ShieldCheck className="h-4 w-4 text-emerald-600" />
                              Portfolio Image Summary ({total}/10 Photos)
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Portfolio Authenticity: <strong className="text-emerald-700">{realPct}%</strong>
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 font-bold text-emerald-800">
                              ✓ {realCount} Likely Real
                            </span>
                            {aiCount > 0 && (
                              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 font-bold text-amber-800">
                                ⚠ {aiCount} AI Generated
                              </span>
                            )}
                            {uncertainCount > 0 && (
                              <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 font-bold text-blue-800">
                                ? {uncertainCount} Unverified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {portfolioItems.map((item, i) => {
                      const isAi =
                        item.aiClassification === 'LIKELY_AI_GENERATED' ||
                        item.contractorConfirmedAI ||
                        item.isAiMarked ||
                        item.authenticity === 'AI_GENERATED' ||
                        item.authenticity === 'LIKELY_AI';

                      const isUncertain = item.aiClassification === 'UNCERTAIN' || item.authenticity === 'UNCERTAIN';

                      const photoUrl = item.imageUrl || item.url || '';

                      return (
                        <div
                          key={i}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs"
                        >
                          <img
                            src={photoUrl}
                            alt={`Portfolio work ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(i)}
                            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-navy-900/80 text-white hover:bg-red-600 transition-colors shadow-xs"
                            title="Remove photo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>

                          {/* Authenticity Badge Indicator */}
                          <div className="absolute bottom-1.5 left-1.5 right-1.5">
                            {isAi ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-900/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-amber-200 shadow-xs border border-amber-500/30">
                                <AlertTriangle className="h-3 w-3 text-amber-300" /> ⚠ AI Generated
                              </span>
                            ) : isUncertain ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-900/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-blue-200 shadow-xs border border-blue-500/30">
                                ? Unverified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-emerald-200 shadow-xs border border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3 text-emerald-300" /> ✓ Likely Real
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
                <Check className="h-6 w-6 text-white" strokeWidth={3} />
              </div>
              <p className="mt-2 text-sm font-semibold text-navy-700">Ready to Submit Profile!</p>
              <p className="text-xs text-gray-500">
                Once submitted, Admin will review your KYC documents. You can access your dashboard right away.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitOnboarding}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-navy-700" />
              ) : (
                <>
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* AI Authenticity Warning Modal (Replace vs Keep) */}
      <AiImageWarningModal
        isOpen={Boolean(pendingAiPhoto)}
        imageUrl={pendingAiPhoto?.url || ''}
        analysis={pendingAiPhoto?.analysis || null}
        onReplace={handleModalReplaceImage}
        onKeep={handleModalKeepImage}
        onClose={() => setPendingAiPhoto(null)}
      />
    </div>
  );
}
