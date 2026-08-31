import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, IndianRupee, Loader2 } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton } from '../components/ui';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiGetProjectFeed, apiSubmitBid, type ApiProject } from '../lib/api';

export function SubmitQuote({
  onNavigate,
  projectId,
}: {
  onNavigate: (id: ScreenId, projectId?: string) => void;
  projectId?: string;
}) {
  const { locale } = useLocale();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [price, setPrice] = useState(2250000);
  const [days, setDays] = useState(240);
  const [materialsIncluded, setMaterialsIncluded] = useState(true);
  const [warranty, setWarranty] = useState('2 Years Comprehensive Warranty');
  const [proposal, setProposal] = useState(
    'We have reviewed the project requirements and are confident in delivering quality work within the proposed budget and timeline. Our experienced team will ensure proper execution and timely completion.'
  );
  const [availability, setAvailability] = useState('2026-09-10');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProject() {
      try {
        const feed = await apiGetProjectFeed();
        if (feed?.projects?.length > 0) {
          const p = (projectId ? feed.projects.find((item) => item._id === projectId) : null) || feed.projects[0];
          setProject(p);
          if (p.budget) setPrice(p.budget);
        }
      } catch {
        // Fallback
      }
    }
    loadProject();
  }, [projectId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (project?._id) {
        await apiSubmitBid({
          projectId: project._id,
          amount: Number(price),
          estimatedDays: Number(days),
          materialsIncluded,
          warranty,
          proposalMessage: proposal || 'Professional quote based on project requirements.',
          availabilityDate: availability,
        });
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error submitting quote. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const maxSliderPrice = project?.budget ? Math.max(project.budget * 2, 5000000) : 5000000;

  return (
    <div className="min-h-screen bg-white">
      <TopNav
        avatarName="Contractor"
        avatarSrc="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150"
        onNavigate={onNavigate}
      />
      <div className="mx-auto max-w-lg px-4 py-6 md:px-6 md:py-8">
        <button
          onClick={() => onNavigate('contractor-dashboard')}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600"
        >
          <ArrowLeft className="h-4 w-4" /> {t(locale, 'back') || 'Back'}
        </button>

        <h1 className="text-2xl font-bold text-navy-700">
          {t(locale, 'submitQuoteTitle') || 'Submit Quotation'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {project?.title || 'Residential Construction'} · {project?.location || 'Coimbatore'}
          {project?.budget ? ` · Target Budget: ₹${project.budget.toLocaleString('en-IN')}` : ''}
        </p>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-xl bg-emerald-50 py-12 text-center animate-fadeIn">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-3 text-lg font-semibold text-navy-700">Quote Submitted Successfully!</p>
            <p className="mt-1 text-sm text-gray-500 max-w-xs">
              The client will review your quote and compare it with matched verified contractors.
            </p>
            <button
              onClick={() => onNavigate('contractor-dashboard')}
              className="mt-6 rounded-lg bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            {/* Quoted price */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-navy-600">
                  {t(locale, 'quotedPrice') || 'Quoted Price (₹)'}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">₹</span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-36 rounded-lg border border-gray-200 px-2.5 py-1 text-right text-sm font-bold text-navy-700 outline-none focus:border-navy-400"
                  />
                </div>
              </div>
              <input
                type="range"
                min={10000}
                max={maxSliderPrice}
                step={10000}
                value={Math.min(price, maxSliderPrice)}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-400">
                <span>₹10,000</span>
                <span>₹{maxSliderPrice.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Estimated days */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">
                {t(locale, 'estimatedDuration') || 'Estimated Duration (Days)'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDays(Math.max(1, days - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-navy-700">{days} days</span>
                <button
                  type="button"
                  onClick={() => setDays(days + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Materials toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-navy-600">Materials Included</p>
                <p className="text-xs text-gray-500">Price covers all required construction materials</p>
              </div>
              <button
                type="button"
                onClick={() => setMaterialsIncluded(!materialsIncluded)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  materialsIncluded ? 'bg-amber-400' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform ${
                    materialsIncluded ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Warranty */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Workmanship Warranty</label>
              <input
                type="text"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                placeholder="e.g. 1 Year Full Warranty"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none focus:border-navy-400"
              />
            </div>

            {/* Proposal note */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Proposal Note</label>
              <div className="flex items-start rounded-lg border border-gray-200 px-3 py-2 focus-within:border-navy-400">
                <textarea
                  rows={3}
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  placeholder="Describe your approach, materials, timeline, and team qualifications..."
                  className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
                <MicInline />
              </div>
            </div>

            {/* Availability date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Can Start Work On</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full bg-transparent text-sm text-navy-700 outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin text-navy-700" />
              ) : (
                'Submit Quotation'
              )}
            </button>
          </div>
        )}
      </div>
      <MicButton />
    </div>
  );
}
