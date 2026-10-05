import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ArrowLeft, Loader2, ShieldCheck, FileText } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiGetProjects, apiSubmitReview, apiCreateDispute, apiGetProjectDisputes, type ApiProject, type ApiDispute } from '../lib/api';

const TAGS = ['On time', 'Professional', 'Good pricing', 'Quality work', 'Clean site', 'Good communication', 'Friendly'];

export function ReviewDispute({ onNavigate, projectId }: { onNavigate: (id: ScreenId) => void; projectId?: string }) {
  const { locale } = useLocale();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [existingDisputes, setExistingDisputes] = useState<ApiDispute[]>([]);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['On time', 'Quality work']);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState('Quality of work');
  const [disputePriority, setDisputePriority] = useState('High');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        const projects = await apiGetProjects();
        if (projects.length > 0) {
          const target = (projectId ? projects.find((p: ApiProject) => p._id === projectId) : null) || projects[0];
          setProject(target);
          if (target?._id) {
            const res = await apiGetProjectDisputes(target._id).catch(() => ({ disputes: [] }));
            setExistingDisputes(res?.disputes || []);
          }
        }
      } catch {
        // Fallback
      }
    }
    loadProject();
  }, [projectId]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleReviewSubmit = async () => {
    setSubmitting(true);
    try {
      if (project?._id) {
        const contractorId =
          typeof project.selectedContractorId === 'string'
            ? project.selectedContractorId
            : project.selectedContractorId?._id || '67c2935293bb85cfd9bbd1a1';

        await apiSubmitReview({
          projectId: project._id,
          contractorId,
          rating,
          reviewText: reviewText || 'Great experience working with this contractor!',
          tags: selectedTags,
        });
      }
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisputeSubmit = async () => {
    if (!project || !disputeDesc.trim()) return;
    try {
      setDisputeSubmitting(true);
      const res = await apiCreateDispute({
        projectId: project._id,
        issueCategory: disputeCategory,
        description: disputeDesc.trim(),
        priority: disputePriority,
      });
      setDisputeSubmitted(true);
      setDisputeOpen(false);
      if (res?.dispute) {
        setExistingDisputes((prev) => [res.dispute, ...prev]);
      }
    } catch (err: any) {
      alert(err?.message || 'Error submitting dispute.');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav onNavigate={onNavigate} />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <button
          onClick={() => onNavigate('client-home')}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600"
        >
          <ArrowLeft className="h-4 w-4" /> {t(locale, 'back') || 'Back'}
        </button>

        <h1 className="text-2xl font-bold text-navy-700">
          {t(locale, 'reviewYourProject') || 'Review Your Project'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {project?.title || 'Residential Construction & Renovation'} · {project?.location || 'Coimbatore'}
        </p>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-xl bg-emerald-50 py-12 text-center animate-fadeIn">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-3 text-lg font-semibold text-navy-700">Thank you for your feedback!</p>
            <p className="mt-1 text-sm text-gray-500 max-w-xs">
              Your review and rating help improve SmartBuild's AI contractor recommendations for future construction projects.
            </p>
            <button
              onClick={() => onNavigate('client-home')}
              className="mt-6 rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              Back to Home
            </button>
          </div>
        ) : (
          <>
            {/* Star rating */}
            <div className="mt-6 flex flex-col items-center rounded-xl bg-gray-100 py-6">
              <p className="mb-3 text-sm font-medium text-navy-600">
                {t(locale, 'howWasExperience') || 'How was your experience with the contractor?'}
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(i)}
                  >
                    <svg
                      className={`h-9 w-9 transition-colors ${
                        (hover || rating) >= i ? 'text-amber-400' : 'text-gray-300'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-gray-500">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent (5.0)'}
              </p>
            </div>

            {/* Review text */}
            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-navy-600">
                {t(locale, 'yourReview') || 'Your Review'}
              </label>
              <textarea
                rows={3}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share details about the contractor's work quality, timeliness, and professionalism..."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
              />
            </div>

            {/* Tag chips */}
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-navy-600">
                {t(locale, 'quickHighlights') || 'Quick Highlights'}
              </p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'border-navy-600 bg-navy-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleReviewSubmit}
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin text-navy-700" />
              ) : (
                'Submit Review'
              )}
            </button>

            {/* Active Project Disputes & History */}
            {existingDisputes.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4 space-y-3">
                <h3 className="text-sm font-bold text-navy-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Project Disputes & Admin Arbitration Status
                </h3>
                {existingDisputes.map((d) => (
                  <div key={d._id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-navy-800">
                        Dispute #{d._id.slice(-6).toUpperCase()}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        d.status === 'OPEN'
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : d.status === 'UNDER_REVIEW'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {d.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase block">Category & Priority</span>
                      <p className="font-bold text-navy-800">{d.issueCategory || (d as any).reason} · Priority: {d.priority || 'Medium'}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase block">Description</span>
                      <p className="text-gray-700 bg-white p-2.5 rounded border border-gray-200 whitespace-pre-wrap">{d.description}</p>
                    </div>

                    {(d.status === 'RESOLVED' || d.status === 'REJECTED') && (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                        <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          Admin Resolution Decision
                        </p>
                        <p className="text-emerald-800"><strong>Outcome:</strong> {d.resolutionOutcome || d.status}</p>
                        <p className="text-emerald-800"><strong>Admin Note:</strong> {d.adminResolutionNote || d.resolutionNotes || 'Arbitration decision recorded by Admin.'}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dispute Banner / Form */}
            <div className="mt-6 border-t border-gray-100 pt-4">
              {disputeSubmitted ? (
                <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  ✓ Dispute submitted for Admin arbitration. Our support team will review within 24 hours.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDisputeOpen(!disputeOpen)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-navy-600"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {t(locale, 'raiseDispute') || 'Have an issue? Raise a Dispute with Admin'}
                    {disputeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {disputeOpen && (
                    <div className="mt-4 animate-fadeIn space-y-3 rounded-lg bg-gray-100 p-4">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-navy-600">Issue Category</label>
                        <select
                          value={disputeCategory}
                          onChange={(e) => setDisputeCategory(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
                        >
                          <option>Milestone / Work Completion</option>
                          <option>Payment / Milestone</option>
                          <option>Quality of work</option>
                          <option>Delay in completion</option>
                          <option>Pricing dispute</option>
                          <option>Material mismatch</option>
                          <option>Unprofessional behavior</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-navy-600">Priority Level</label>
                        <select
                          value={disputePriority}
                          onChange={(e) => setDisputePriority(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-navy-600">Description</label>
                        <textarea
                          rows={3}
                          value={disputeDesc}
                          onChange={(e) => setDisputeDesc(e.target.value)}
                          placeholder="Describe the issue and how you would like it resolved..."
                          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleDisputeSubmit}
                        disabled={disputeSubmitting}
                        className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {disputeSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : 'Submit Dispute for Admin Review'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
