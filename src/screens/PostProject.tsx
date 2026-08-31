import { useState, useEffect, useRef } from 'react';
import { MapPin, Upload, FileText, Sparkles, ArrowLeft, Loader2, X, ImageIcon, CheckCircle2, Bell, Send } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton } from '../components/ui';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiPostProject, apiDetectCategory, apiUploadFiles, type ApiProject } from '../lib/api';

export const CATEGORIES = [
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
  'Water Proofing',
  'Landscaping',
  'Demolition',
  'Renovation',
  'Structural Work',
  'Other',
];

const DEFAULT_CATEGORY = CATEGORIES[0];

export function PostProject({
  onNavigate,
}: {
  onNavigate: (id: ScreenId, projectId?: string) => void;
}) {
  const { locale } = useLocale();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Coimbatore, Tamil Nadu');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [streetArea, setStreetArea] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [timeline, setTimeline] = useState('Within a week');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [categoryEdit, setCategoryEdit] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiDetected, setAiDetected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdProject, setCreatedProject] = useState<ApiProject | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // File upload state
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGES = 5;
  const MAX_IMAGE_MB = 5;
  const MAX_PDF_MB = 20;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError('');
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageError(`Maximum ${MAX_IMAGES} images allowed.`);
      e.target.value = '';
      return;
    }

    const toAdd: File[] = [];
    for (const file of selected.slice(0, remaining)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setImageError(`"${file.name}" is not a supported image type. Use JPG, PNG, or WEBP.`);
        e.target.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        setImageError(`"${file.name}" exceeds ${MAX_IMAGE_MB} MB limit.`);
        e.target.value = '';
        return;
      }
      toAdd.push(file);
    }

    const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...toAdd]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdfError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setPdfError(`"${file.name}" is not a PDF file.`);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setPdfError(`PDF exceeds ${MAX_PDF_MB} MB limit.`);
      e.target.value = '';
      return;
    }
    setPdf(file);
    e.target.value = '';
  };

  const removePdf = () => setPdf(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger AI detection whenever title or description changes (debounced 800ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (trimmedTitle.length < 3 && trimmedDesc.length < 10) {
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setAiLoading(true);
      setAiError('');
      try {
        const detected = await apiDetectCategory(trimmedTitle, trimmedDesc);
        setCategory(detected);
        setAiDetected(true);
        setCategoryEdit(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('not configured')) {
          setAiError('AI service not configured. Add your API key in server/.env.');
        } else {
          setAiError('AI detection unavailable. Please select a category manually.');
        }
        setAiDetected(false);
      } finally {
        setAiLoading(false);
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, description]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please enter location manually.');
      return;
    }
    setLocationLoading(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'SmartBuild/1.0' } }
          );
          const data = await res.json();
          const a = data.address ?? {};

          const parts: string[] = [
            a.house_number,
            a.road || a.pedestrian,
            a.neighbourhood || a.residential,
            a.suburb,
            a.state_district || a.city || a.town || a.village || a.county,
            a.state,
            a.postcode,
          ]
            .map((p) => (p ?? '').trim())
            .filter(Boolean);

          const deduped = parts.filter(
            (p, i) => i === 0 || p.toLowerCase() !== parts[i - 1].toLowerCase()
          );

          setLocation(deduped.length ? deduped.join(', ') : data.display_name ?? '');
        } catch {
          setLocationError('Could not convert coordinates to address. Please enter location manually.');
        } finally {
          setLocationLoading(false);
        }
      },
      (err) => {
        setLocationLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Please enter location manually.');
        } else {
          setLocationError('Could not detect location. Please enter location manually.');
        }
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !location.trim()) {
      setSubmitError('Please fill in the title, description, and location.');
      return;
    }
    if (!CATEGORIES.includes(category)) {
      setSubmitError('Please select a valid category.');
      return;
    }
    const budgetNum = Number(budget);
    if (!budget.trim() || isNaN(budgetNum) || budgetNum <= 0) {
      setBudgetError('Please enter a valid budget greater than 0.');
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const locationParts = [houseNo.trim(), streetArea.trim(), location.trim()].filter(Boolean);
      const fullLocation = locationParts.join(', ');
      let imageUrls: string[] = [];
      let pdfUrl: string | null = null;
      if (images.length > 0 || pdf) {
        const uploaded = await apiUploadFiles(images, pdf);
        imageUrls = uploaded.imageUrls;
        pdfUrl = uploaded.pdfUrl;
      }
      const newProject = await apiPostProject({
        title: title.trim(),
        description: description.trim(),
        category,
        budget: Number(budget),
        timeline,
        location: fullLocation,
        houseNo: houseNo.trim() || undefined,
        streetArea: streetArea.trim() || undefined,
        imageUrls,
        pdfUrl,
      });

      setSubmitting(false);
      setCreatedProject(newProject);
      setShowSuccessModal(true);
    } catch (err: unknown) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit project.');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav onNavigate={onNavigate} />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <button onClick={() => onNavigate('client-home')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600">
          <ArrowLeft className="h-4 w-4" /> {t(locale, 'back')}
        </button>
        <h1 className="text-2xl font-bold text-navy-700">{t(locale, 'postProjectTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t(locale, 'postProjectSubtitle')}</p>

        <div className="mt-6 space-y-5">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">{t(locale, 'projectTitleLabel')}</label>
            <input
              placeholder={t(locale, 'projectTitlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
            />
          </div>

          {/* Description with Voice Input */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">{t(locale, 'descriptionLabel')}</label>
            <div className="flex items-start rounded-lg border border-gray-200 px-3 py-2 focus-within:border-navy-400">
              <textarea
                rows={3}
                placeholder={t(locale, 'descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
              />
              <MicInline
                onTranscript={(text) =>
                  setDescription((prev) => (prev ? `${prev} ${text}` : text))
                }
              />
            </div>
          </div>

          {/* AI-suggested category */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                ) : (
                  <Sparkles className="h-4 w-4 text-amber-500" />
                )}
                <div>
                  <p className="text-xs text-amber-600">
                    {aiLoading
                      ? 'Detecting category…'
                      : aiDetected
                      ? t(locale, 'aiDetectedCategory')
                      : 'Category'}
                  </p>
                  {categoryEdit ? (
                    <select
                      value={category}
                      onChange={(e) => { setCategory(e.target.value); setAiDetected(false); }}
                      onBlur={() => setCategoryEdit(false)}
                      autoFocus
                      className="mt-0.5 rounded border border-amber-300 bg-white px-2 py-0.5 text-sm font-semibold text-navy-700 outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-navy-700">
                      {category}
                      {aiDetected && (
                        <span className="ml-1 font-normal text-gray-500">— {t(locale, 'confidence')}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              {!categoryEdit && !aiLoading && (
                <button
                  type="button"
                  onClick={() => setCategoryEdit(true)}
                  className="text-xs font-medium text-navy-500 hover:text-navy-700"
                >
                  {t(locale, 'editCategory')}
                </button>
              )}
            </div>
            {aiError && (
              <p className="mt-2 text-xs text-amber-700">{aiError}</p>
            )}
          </div>

          {/* Budget input */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">{t(locale, 'budgetLabel')}</label>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 focus-within:border-navy-400 ${budgetError ? 'border-red-400' : 'border-gray-200'}`}>
              <span className="text-sm font-medium text-gray-500">₹</span>
              <input
                type="number"
                min={1}
                placeholder={t(locale, 'budgetPlaceholder')}
                value={budget}
                onChange={(e) => { setBudget(e.target.value); setBudgetError(''); }}
                className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            {budgetError && <p className="mt-1 text-xs text-red-500">{budgetError}</p>}
          </div>

          {/* Timeline */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">{t(locale, 'timelineLabel')}</label>
            <select
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none focus:border-navy-400"
            >
              <option>{t(locale, 'timelineImmediate')}</option>
              <option>{t(locale, 'timelineWeek')}</option>
              <option>{t(locale, 'timelineFlexible')}</option>
            </select>
          </div>

          {/* Location with GPS */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">{t(locale, 'locationLabel')}</label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
              <input
                placeholder={locationLoading ? 'Detecting location…' : t(locale, 'locationPlaceholder')}
                value={location}
                onChange={(e) => { setLocation(e.target.value); setLocationError(''); }}
                disabled={locationLoading}
                className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={locationLoading}
                title={t(locale, 'detectLocationHint')}
                className="shrink-0 text-gray-400 transition-colors hover:text-navy-600 disabled:opacity-40"
              >
                {locationLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </button>
            </div>
            {locationError && <p className="mt-1 text-xs text-red-500">{locationError}</p>}
          </div>

          {/* House / Plot No. */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">
              {t(locale, 'houseNoLabel')}
            </label>
            <input
              placeholder={t(locale, 'houseNoPlaceholder')}
              value={houseNo}
              onChange={(e) => setHouseNo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
            />
          </div>

          {/* Street / Area / Landmark */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">
              {t(locale, 'streetAreaLabel')}
            </label>
            <input
              placeholder={t(locale, 'streetAreaPlaceholder')}
              value={streetArea}
              onChange={(e) => setStreetArea(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
            />
          </div>

          {/* Reference Images (Optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">
              {t(locale, 'projectPhotosLabel')}
            </label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            {/* Thumbnails */}
            {imagePreviews.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {imagePreviews.map((src, idx) => (
                  <div key={idx} className="relative h-20 w-20 shrink-0">
                    <img src={src} alt={`preview-${idx}`} className="h-full w-full rounded-lg object-cover border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 transition-colors hover:border-navy-300 hover:text-navy-500"
              >
                <ImageIcon className="h-5 w-5" />
                <span>{t(locale, 'uploadPhotosHint')}</span>
              </button>
            )}
            {imageError && <p className="mt-1 text-xs text-red-500">{imageError}</p>}
          </div>

          {/* Project Document PDF (Optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">
              {t(locale, 'documentsLabel')}
            </label>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfSelect}
            />
            {pdf ? (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-navy-500" />
                  <span className="truncate text-sm text-navy-700">{pdf.name}</span>
                </div>
                <button type="button" onClick={removePdf} className="ml-2 shrink-0 text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 transition-colors hover:border-navy-300 hover:text-navy-500"
              >
                <FileText className="h-5 w-5" />
                <span>{t(locale, 'uploadDocsHint')}</span>
              </button>
            )}
            {pdfError && <p className="mt-1 text-xs text-red-500">{pdfError}</p>}
          </div>

          {/* Submit */}
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300 disabled:opacity-70"
          >
            {submitting ? t(locale, 'submitting') : t(locale, 'submitProject')}
          </button>
        </div>
      </div>

      {/* AI Analyzing / Dispatching overlay */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-float animate-scaleIn">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 animate-pulseAmber rounded-full" />
              <div className="flex h-full w-full items-center justify-center rounded-full bg-amber-50">
                <Sparkles className="h-7 w-7 text-amber-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-navy-700">Posting & Dispatching Project...</p>
              <p className="mt-1 text-sm text-gray-500">Alerting verified available {category} contractors</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 rounded-full bg-amber-400"
                  style={{ animation: `pulseAmber 1s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8 shadow-float animate-scaleIn text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-navy-800">Project Posted & Broadcasted!</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your project <span className="font-semibold text-navy-700">"{createdProject?.title || title}"</span> has been posted and broadcasted to verified available <span className="font-semibold text-navy-700">{createdProject?.category || category}</span> contractors.
            </p>
            <div className="my-5 rounded-xl bg-gray-50 border border-gray-100 p-4 text-left text-xs space-y-2.5 text-gray-600 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span>
                <span>Notifications dispatched to matching domain contractors</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold">⏳</span>
                <span>Contractors will review requirements and submit quotations</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">🔔</span>
                <span>You will receive live notifications as quotes arrive</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => onNavigate('client-home')}
                className="w-full rounded-xl bg-navy-600 py-3 text-sm font-semibold text-white hover:bg-navy-700 shadow-md transition-transform active:scale-95"
              >
                Go to My Dashboard
              </button>
              <button
                onClick={() => onNavigate('contractor-results', createdProject?._id)}
                className="w-full rounded-xl border border-navy-200 py-2.5 text-xs font-semibold text-navy-600 hover:bg-navy-50"
              >
                View Project Status (0 Bids)
              </button>
            </div>
          </div>
        </div>
      )}

      <MicButton
        onTranscript={(text) =>
          setDescription((prev) => (prev ? `${prev} ${text}` : text))
        }
      />
    </div>
  );
}
