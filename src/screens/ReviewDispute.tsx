import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  FileText,
  Clock,
  Scale,
  Handshake,
  CheckCircle2,
  DollarSign,
  Calendar,
  XCircle,
  BadgeAlert,
  Building2,
  MapPin,
  Sparkles,
  Star,
  PlusCircle,
  MessageSquare,
  Award,
  AlertCircle,
  X,
} from 'lucide-react';
import { TopNav } from '../components/TopNav';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import {
  apiGetProjects,
  apiGetContractorMyProjects,
  apiGetMe,
  apiSubmitReview,
  apiGetProjectReviews,
  apiCreateDispute,
  apiGetProjectDisputes,
  apiRespondToDispute,
  apiAcceptCompromise,
  apiCleanBreak,
  type ApiProject,
  type ApiDispute,
  type ApiUser,
  type ApiReviewItem,
} from '../lib/api';

const TAGS = ['On time', 'Professional', 'Good pricing', 'Quality work', 'Clean site', 'Good communication', 'Friendly'];

function DisputeTimer({ expiresAt, status }: { expiresAt?: string; status: string }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!expiresAt || (status !== 'OPEN' && status !== 'COMPROMISE_OFFERED')) return;

    function calc() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    }

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, status]);

  if (status !== 'OPEN' && status !== 'COMPROMISE_OFFERED') return null;

  if (timeLeft.isExpired) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-[11px] font-bold text-red-800 border border-red-300">
        <Clock className="h-3.5 w-3.5 text-red-600 animate-spin" />
        <span>72h Expired · Default Auto-Rule Executing</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 border border-amber-300">
      <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
      <Clock className="h-3.5 w-3.5 text-amber-700" />
      <span>
        Auto-Settle in: {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
      </span>
    </div>
  );
}

export function ReviewDispute({ onNavigate, projectId }: { onNavigate: (id: ScreenId) => void; projectId?: string }) {
  const { locale } = useLocale();
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [projectsList, setProjectsList] = useState<ApiProject[]>([]);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [existingDisputes, setExistingDisputes] = useState<ApiDispute[]>([]);
  const [loading, setLoading] = useState(true);

  // Active top tab: Reviews vs 72h Dispute Resolution
  const [activeTab, setActiveTab] = useState<'reviews' | 'disputes'>('reviews');

  // Reviews state (Project Reviews & Rating)
  const [projectReviews, setProjectReviews] = useState<ApiReviewItem[]>([]);
  const [myExistingReview, setMyExistingReview] = useState<ApiReviewItem | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['On time', 'Quality work']);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Dispute creation form state
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeType, setDisputeType] = useState('QUALITY_DEFECT');
  const [remedyType, setRemedyType] = useState('REWORK_REQUEST');
  const [remedyAmount, setRemedyAmount] = useState<number>(5000);
  const [remedyDays, setRemedyDays] = useState<number>(3);
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputePriority, setDisputePriority] = useState('High');
  const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeSuccessMsg, setDisputeSuccessMsg] = useState('');

  // Respondent compromise / rebuttal interactive states
  const [activeCompromiseId, setActiveCompromiseId] = useState<string | null>(null);
  const [compType, setCompType] = useState<'SPLIT_50_50' | 'PARTIAL_DISCOUNT' | 'COUNTER_TIMELINE' | 'COUNTER_REWORK'>('SPLIT_50_50');
  const [compAmount, setCompAmount] = useState<number>(2500);
  const [compDays, setCompDays] = useState<number>(3);
  const [compNote, setCompNote] = useState('');
  const [respondingActionId, setRespondingActionId] = useState<string | null>(null);

  // Rebuttal state
  const [activeRebuttalId, setActiveRebuttalId] = useState<string | null>(null);
  const [rebuttalStatement, setRebuttalStatement] = useState('');
  const [rebuttalEvidence, setRebuttalEvidence] = useState('');

  // In-Dashboard feedback & confirmation modal states (no native alert/confirm popups)
  const [inAppNotification, setInAppNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    subtitle: string;
    confirmLabel: string;
    confirmColor: 'emerald' | 'blue' | 'indigo' | 'amber';
    icon: 'check' | 'handshake' | 'scale';
    action: () => Promise<void> | void;
  } | null>(null);
  const [confirmActionLoading, setConfirmActionLoading] = useState(false);

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    setInAppNotification({ type, message });
  };

  useEffect(() => {
    if (!inAppNotification) return;
    const timer = setTimeout(() => {
      setInAppNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [inAppNotification]);

  // 1. Load user profile and relevant projects
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        let user: ApiUser | null = null;
        try {
          user = await apiGetMe();
          setCurrentUser(user);
        } catch {
          // Unauthenticated or fallback
        }

        const isContractorRole = user?.role === 'CONTRACTOR';

        // Set default dispute type according to role
        if (isContractorRole) {
          setDisputeType('PAYMENT_WITHHELD');
          setRemedyType('AUTO_PAYOUT');
        } else {
          setDisputeType('QUALITY_DEFECT');
          setRemedyType('REWORK_REQUEST');
        }

        let projects: ApiProject[] = [];
        if (isContractorRole) {
          projects = await apiGetContractorMyProjects().catch(() => []);
        } else {
          projects = await apiGetProjects().catch(() => []);
        }

        setProjectsList(projects);

        if (projects.length > 0) {
          const target = (projectId ? projects.find((p: ApiProject) => p._id === projectId) : null) || projects[0];
          setProject(target);
          if (target?._id) {
            await Promise.all([
              loadDisputes(target._id),
              loadReviews(target._id, user?._id),
            ]);
          }
        }
      } catch (err) {
        console.error('Initialization error in ReviewDispute:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [projectId]);

  const loadDisputes = async (pId: string) => {
    try {
      const res = await apiGetProjectDisputes(pId);
      setExistingDisputes(res?.disputes || []);
    } catch {
      setExistingDisputes([]);
    }
  };

  const loadReviews = async (pId: string, currentUserId?: string) => {
    try {
      setReviewsLoading(true);
      const res = await apiGetProjectReviews(pId);
      const revs = res?.reviews || [];
      setProjectReviews(revs);

      const targetUserId = currentUserId || currentUser?._id;
      const myRev = revs.find(
        (r: any) =>
          (typeof r.clientId === 'object' && r.clientId?._id === targetUserId) ||
          r.clientId === targetUserId
      );

      if (myRev) {
        setMyExistingReview(myRev);
        setSubmitted(true);
        setRating(myRev.rating);
        setReviewText(myRev.reviewText || '');
        if (myRev.tags) setSelectedTags(myRev.tags);
      } else {
        setMyExistingReview(null);
        setSubmitted(false);
      }
    } catch {
      setProjectReviews([]);
      setMyExistingReview(null);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleSelectProject = async (pId: string) => {
    const found = projectsList.find((p) => p._id === pId);
    if (found) {
      setProject(found);
      await Promise.all([
        loadDisputes(found._id),
        loadReviews(found._id),
      ]);
    }
  };

  const isContractor = currentUser?.role === 'CONTRACTOR';

  // Toggle tag for reviews
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Submit client review
  const handleReviewSubmit = async () => {
    if (!project?._id) return;
    setSubmitting(true);
    try {
      const contractorId =
        typeof project.selectedContractorId === 'string'
          ? project.selectedContractorId
          : (project.selectedContractorId as any)?._id || '67c2935293bb85cfd9bbd1a1';

      const res = await apiSubmitReview({
        projectId: project._id,
        contractorId,
        rating,
        reviewText: reviewText || 'Great experience working with this contractor!',
        tags: selectedTags,
      });

      setSubmitted(true);
      if (res?.review) {
        setMyExistingReview(res.review);
        setProjectReviews((prev) => [res.review, ...prev.filter((r) => r._id !== res.review._id)]);
      }
      notify('success', 'Thank you! Your project review has been submitted.');
    } catch (err: any) {
      notify('error', err?.message || 'Error submitting review.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit new dispute with 72-hour auto-settlement remedy
  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !disputeDesc.trim()) return;

    try {
      setDisputeSubmitting(true);
      const categoryMap: Record<string, string> = {
        PAYMENT_WITHHELD: 'Payment Withheld (Work Done)',
        SCOPE_CREEP: 'Scope Creep (Unpaid Extra Work)',
        SITE_ACCESS_DELAY: 'Site Inaccessible / Client Delays',
        OTHER_CONTRACTOR: 'Contractor General Issue',
        QUALITY_DEFECT: 'Quality Defect / Poor Workmanship',
        WORK_ABANDONED: 'Work Abandoned / Major Delays',
        MATERIAL_MISMATCH: 'Material Mismatch / Substandard Materials',
        OTHER_CLIENT: 'Client General Issue',
      };

      const requestedAction = {
        type: remedyType,
        amount: remedyType === 'MILESTONE_DISCOUNT' || remedyType === 'AUTO_PAYOUT' ? remedyAmount : 0,
        days: remedyType === 'REWORK_REQUEST' || remedyType === 'TIMELINE_EXTENSION' ? remedyDays : 0,
        notes: disputeDesc.trim(),
      };

      const res = await apiCreateDispute({
        projectId: project._id,
        title: `${categoryMap[disputeType] || disputeType}`,
        issueCategory: categoryMap[disputeType] || disputeType,
        disputeType,
        description: disputeDesc.trim(),
        priority: disputePriority,
        requestedAction,
        evidenceUrls: disputeEvidenceUrl ? [disputeEvidenceUrl.trim()] : [],
      });

      notify('success', 'Dispute raised! 72-hour automated resolution countdown started.');
      setDisputeOpen(false);
      setDisputeDesc('');
      setDisputeEvidenceUrl('');
      if (res?.dispute) {
        setExistingDisputes((prev) => [res.dispute, ...prev]);
      }
    } catch (err: any) {
      notify('error', err?.message || 'Error submitting dispute.');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  // Respondent 1-Click Accept (In-Dashboard Modal & Instant Optimistic UI Update)
  const handleAcceptRemedy = (disputeId: string, simulateRespondent = false) => {
    setConfirmModal({
      title: 'Accept Settlement Proposal',
      subtitle: 'Accept this settlement proposal? This will immediately resolve the dispute mutually without admin intervention.',
      confirmLabel: 'Confirm & Accept Settlement',
      confirmColor: 'emerald',
      icon: 'check',
      action: async () => {
        // 1. Instant Optimistic update so the UI updates in 0ms!
        setExistingDisputes((prev) =>
          prev.map((d) =>
            d._id === disputeId
              ? {
                  ...d,
                  status: 'RESOLVED_MUTUALLY',
                  resolutionOutcome: 'MUTUALLY_RESOLVED',
                  resolutionNotes: 'Mutual remedy accepted by counterpart.',
                  autoResolutionDetails: {
                    resolvedAt: new Date().toISOString(),
                    ruleApplied: 'Mutual Remedy Accepted',
                    outcomeSummary: 'Settlement proposal accepted. Dispute mutually resolved without admin intervention.',
                  },
                }
              : d
          )
        );
        notify('success', 'Settlement accepted! The dispute is now mutually resolved without admin intervention.');

        try {
          setRespondingActionId(disputeId);
          const res = await apiRespondToDispute(disputeId, {
            action: 'ACCEPT',
            simulateRespondent,
          });
          if (res?.dispute) {
            setExistingDisputes((prev) => prev.map((d) => (d._id === disputeId ? res.dispute : d)));
          }
        } catch (err: any) {
          if (err?.message?.includes('already')) {
            notify('info', 'Dispute is already recorded as resolved.');
          } else {
            notify('error', err?.message || 'Error accepting settlement.');
            if (project?._id) loadDisputes(project._id);
          }
        } finally {
          setRespondingActionId(null);
        }
      },
    });
  };

  // Respondent Propose Compromise
  const handleProposeCompromiseSubmit = async (disputeId: string, simulateRespondent = false) => {
    try {
      setRespondingActionId(disputeId);
      const res = await apiRespondToDispute(disputeId, {
        action: 'PROPOSE_COMPROMISE',
        simulateRespondent,
        proposedSettlement: {
          type: compType,
          amount: compAmount,
          days: compDays,
          message: compNote.trim() || 'Mutual compromise proposed.',
        },
      });
      if (res?.dispute) {
        setExistingDisputes((prev) => prev.map((d) => (d._id === disputeId ? res.dispute : d)));
      }
      setActiveCompromiseId(null);
      setCompNote('');
      notify('success', 'Compromise submitted! The other party has been notified to review.');
    } catch (err: any) {
      notify('error', err?.message || 'Error submitting compromise.');
    } finally {
      setRespondingActionId(null);
    }
  };

  // Filer Accept Compromise (In-Dashboard Modal & Instant Optimistic UI Update)
  const handleAcceptCompromiseOffer = (disputeId: string) => {
    setConfirmModal({
      title: 'Accept Compromise Terms',
      subtitle: 'Accept this compromise offer? Both parties have agreed to the middle ground and this dispute will be closed mutually.',
      confirmLabel: 'Confirm & Accept Compromise',
      confirmColor: 'emerald',
      icon: 'handshake',
      action: async () => {
        // Instant Optimistic update
        setExistingDisputes((prev) =>
          prev.map((d) =>
            d._id === disputeId
              ? {
                  ...d,
                  status: 'RESOLVED_MUTUALLY',
                  resolutionOutcome: 'MUTUALLY_RESOLVED',
                  resolutionNotes: 'Mutual compromise agreed and accepted.',
                  autoResolutionDetails: {
                    resolvedAt: new Date().toISOString(),
                    ruleApplied: 'Compromise Accepted',
                    outcomeSummary: 'Dispute filer accepted compromise terms. Mutually resolved.',
                  },
                }
              : d
          )
        );
        notify('success', 'Compromise accepted! Dispute resolved mutually.');

        try {
          setRespondingActionId(disputeId);
          const res = await apiAcceptCompromise(disputeId);
          if (res?.dispute) {
            setExistingDisputes((prev) => prev.map((d) => (d._id === disputeId ? res.dispute : d)));
          }
        } catch (err: any) {
          if (err?.message?.includes('already')) {
            notify('info', 'Compromise is already recorded as accepted.');
          } else {
            notify('error', err?.message || 'Error accepting compromise.');
            if (project?._id) loadDisputes(project._id);
          }
        } finally {
          setRespondingActionId(null);
        }
      },
    });
  };

  // Clean Break 50/50 (In-Dashboard Modal & Instant Optimistic UI Update)
  const handleCleanBreak = (disputeId: string) => {
    setConfirmModal({
      title: 'Execute 50/50 Clean Break',
      subtitle: 'Execute 50/50 Clean Break? Both parties will split remaining liability equally and release the project amicably without penalties.',
      confirmLabel: 'Confirm 50/50 Clean Break',
      confirmColor: 'indigo',
      icon: 'scale',
      action: async () => {
        // Instant Optimistic update
        setExistingDisputes((prev) =>
          prev.map((d) =>
            d._id === disputeId
              ? {
                  ...d,
                  status: 'RESOLVED_CLEAN_BREAK',
                  resolutionOutcome: 'CLEAN_BREAK_RESOLVED',
                  resolutionNotes: '50/50 Clean break mutual exit applied.',
                  autoResolutionDetails: {
                    resolvedAt: new Date().toISOString(),
                    ruleApplied: '50/50 Clean Break Rule',
                    outcomeSummary: '50/50 mutual exit rule executed. Disputed milestone liability split equally.',
                  },
                }
              : d
          )
        );
        notify('success', '50/50 Clean break executed. Contract concluded amicably.');

        try {
          setRespondingActionId(disputeId);
          const res = await apiCleanBreak(disputeId);
          if (res?.dispute) {
            setExistingDisputes((prev) => prev.map((d) => (d._id === disputeId ? res.dispute : d)));
          }
        } catch (err: any) {
          notify('error', err?.message || 'Error executing clean break.');
          if (project?._id) loadDisputes(project._id);
        } finally {
          setRespondingActionId(null);
        }
      },
    });
  };

  // Submit Rebuttal / Evidence
  const handleSubmitRebuttal = async (disputeId: string) => {
    if (!rebuttalStatement.trim()) return;
    try {
      setRespondingActionId(disputeId);
      const res = await apiRespondToDispute(disputeId, {
        action: 'REBUTTAL',
        rebuttal: {
          statement: rebuttalStatement.trim(),
          evidenceUrls: rebuttalEvidence ? [rebuttalEvidence.trim()] : [],
        },
      });
      if (res?.dispute) {
        setExistingDisputes((prev) => prev.map((d) => (d._id === disputeId ? res.dispute : d)));
      }
      setActiveRebuttalId(null);
      setRebuttalStatement('');
      setRebuttalEvidence('');
      notify('success', 'Counter-evidence recorded successfully.');
    } catch (err: any) {
      notify('error', err?.message || 'Error submitting rebuttal.');
    } finally {
      setRespondingActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav onNavigate={onNavigate} />

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <button
          onClick={() => onNavigate(isContractor ? 'contractor-dashboard' : 'client-home')}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-navy-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> {t(locale, 'back') || 'Back to Dashboard'}
        </button>

        {/* In-Dashboard Feedback / Alert Banner */}
        {inAppNotification && (
          <div
            className={`mb-4 flex items-center justify-between rounded-xl border p-4 text-xs font-semibold shadow-xs animate-fadeIn ${
              inAppNotification.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : inAppNotification.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {inAppNotification.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
              {inAppNotification.type === 'error' && <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
              {inAppNotification.type === 'info' && <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />}
              <span>{inAppNotification.message}</span>
            </div>
            <button
              onClick={() => setInAppNotification(null)}
              className="ml-3 text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Header Banner */}
        <div className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200 space-y-5">
          {/* Top Row: Protocol & Role badges, Title & Subtitle */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800 flex items-center gap-1.5 shadow-2xs">
                <Scale className="h-3.5 w-3.5 text-amber-600" /> 72-Hour Auto-Settle Protocol
              </span>
              <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                {isContractor ? 'Contractor View' : 'Client View'}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900">
              {isContractor ? 'Contractor Dispute & Settlement Center' : 'Project Review & Dispute Resolution'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Automated 2-way resolution: Settle claims directly with your counterpart in 72 hours without waiting for manual admin review.
            </p>
          </div>

          {/* Active Project Context Card */}
          {project && (
            <div className="rounded-xl border border-slate-200 bg-linear-to-r from-slate-50/90 via-white to-slate-50/60 p-4 shadow-2xs">
              {/* Top Sub-bar: Status Label & Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Active Project Context
                  </span>
                </div>

                {projectsList.length > 1 && (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <label className="text-[11px] font-semibold text-slate-400 shrink-0">
                      Switch:
                    </label>
                    <div className="relative w-full sm:w-64 max-w-xs">
                      <select
                        value={project._id || ''}
                        onChange={(e) => handleSelectProject(e.target.value)}
                        className="appearance-none w-full truncate rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-navy-900 shadow-2xs hover:border-slate-300 focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100 transition-all cursor-pointer"
                        title={project.title}
                      >
                        {projectsList.map((p) => {
                          const firstLoc = p.location ? ` (${p.location.split(',')[0].trim()})` : '';
                          const fullLabel = `${p.title}${firstLoc}`;
                          return (
                            <option key={p._id} value={p._id} title={`${p.title} (${p.location || 'Local'})`}>
                              {fullLabel.length > 40 ? fullLabel.slice(0, 37) + '...' : fullLabel}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* Main Project Details */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-amber-400 shadow-xs ring-4 ring-slate-100/80">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-navy-950 leading-snug">
                      {project.title}
                    </h2>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                      project.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : project.status === 'IN_PROGRESS'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {project.status || 'ACTIVE'}
                    </span>
                  </div>

                  {/* Metadata Badges */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                    {project.location && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-slate-600 font-medium shadow-2xs">
                        <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        <span className="truncate max-w-[280px] sm:max-w-md" title={project.location}>
                          {project.location}
                        </span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-800 font-semibold shadow-2xs">
                      <span>Budget:</span>
                      <span className="font-bold">₹{project.budget?.toLocaleString('en-IN') || 'N/A'}</span>
                    </span>
                    {project.category && (
                      <span className="inline-flex items-center rounded-lg bg-slate-100 border border-slate-200/60 px-2.5 py-1 text-slate-600 font-medium">
                        {project.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs: Project Reviews & Ratings vs 72h Dispute Resolution */}
        <div className="mt-6 flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'reviews'
                ? 'border-navy-900 text-navy-900 bg-white/60'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Star className={`h-4 w-4 ${activeTab === 'reviews' ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
            <span>Project Reviews & Ratings</span>
            {projectReviews.length > 0 && (
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {projectReviews.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('disputes')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'disputes'
                ? 'border-amber-600 text-amber-900 bg-white/60'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Scale className={`h-4 w-4 ${activeTab === 'disputes' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>72h Dispute Resolution</span>
            {existingDisputes.filter((d) => d.status === 'OPEN').length > 0 ? (
              <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 animate-pulse">
                {existingDisputes.filter((d) => d.status === 'OPEN').length} active
              </span>
            ) : existingDisputes.length > 0 ? (
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {existingDisputes.length}
              </span>
            ) : null}
          </button>
        </div>

        {/* ── TAB 1: PROJECT REVIEWS & RATINGS ───────────────────────────── */}
        {activeTab === 'reviews' && (
          <div className="mt-6 space-y-6 animate-fadeIn">
            {/* Review Submission Card (for Client) */}
            {!isContractor && (
              <div className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
                      <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
                      {t(locale, 'reviewYourProject') || 'Project Review & Contractor Rating'}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Rate your contractor's craft, punctuality, and materials to build verified platform trust.
                    </p>
                  </div>

                  {project?.status && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                      project.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-blue-50 text-blue-800 border-blue-300'
                    }`}>
                      {project.status === 'COMPLETED' ? '✓ Eligible for Review' : `Project Status: ${project.status}`}
                    </span>
                  )}
                </div>

                {submitted || myExistingReview ? (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-950">Your Project Review is Published</span>
                      </div>
                      <button
                        onClick={() => setSubmitted(false)}
                        className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                      >
                        Edit Feedback
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
                        />
                      ))}
                      <span className="ml-2 font-bold text-sm text-navy-900">{rating}.0 / 5.0</span>
                    </div>

                    {reviewText && (
                      <p className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-emerald-200/60 leading-relaxed">
                        "{reviewText}"
                      </p>
                    )}

                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedTags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-white border border-emerald-300 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 shadow-2xs"
                          >
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Notice if project not yet completed */}
                    {project && project.status !== 'COMPLETED' && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Project is currently {project.status}.</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            You can draft your feedback now. Official contractor ratings take effect once the final milestone is signed off.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Star rating */}
                    <div className="mt-5 flex flex-col items-center rounded-xl bg-slate-50 py-5 border border-slate-100">
                      <p className="mb-2 text-xs font-semibold text-slate-700">
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
                            className="p-1 transition-transform hover:scale-110 cursor-pointer"
                          >
                            <Star
                              className={`h-8 w-8 transition-colors ${
                                (hover || rating) >= i
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-300 hover:text-amber-200'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-xs font-bold text-navy-900">
                        {rating === 1 && '⭐ 1.0 - Poor (Significant Issues)'}
                        {rating === 2 && '⭐⭐ 2.0 - Fair (Needs Improvement)'}
                        {rating === 3 && '⭐⭐⭐ 3.0 - Good (Satisfactory Work)'}
                        {rating === 4 && '⭐⭐⭐⭐ 4.0 - Very Good (Highly Professional)'}
                        {rating === 5 && '⭐⭐⭐⭐⭐ 5.0 - Excellent (Exceptional Quality)'}
                      </p>
                    </div>

                    {/* Review text */}
                    <div className="mt-4">
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        {t(locale, 'yourReview') || 'Written Feedback & Comments'}
                      </label>
                      <textarea
                        rows={3}
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Share specific feedback regarding quality of materials, punctuality, communication, and site cleanliness..."
                        className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-navy-900 placeholder-slate-400 outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                      />
                    </div>

                    {/* Tag chips */}
                    <div className="mt-4">
                      <p className="mb-1.5 text-xs font-semibold text-slate-700">
                        {t(locale, 'quickHighlights') || 'Key Strengths & Highlights'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                              selectedTags.includes(tag)
                                ? 'border-navy-800 bg-navy-800 text-white shadow-2xs'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {selectedTags.includes(tag) ? `✓ ${tag}` : `+ ${tag}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit review button */}
                    <button
                      type="button"
                      onClick={handleReviewSubmit}
                      disabled={submitting}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-xs font-bold text-navy-950 transition-colors hover:bg-amber-300 disabled:opacity-60 shadow-xs cursor-pointer"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin text-navy-900" /> : 'Publish Project Review & Rating'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Contractor Reputation Summary (for Contractor) */}
            {isContractor && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-navy-900">Contractor Reputation & Reviews Center</h2>
                    <p className="text-xs text-slate-500">
                      View client ratings and reviews submitted for this project and your platform profile.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Verified Project Reviews List */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-navy-700" />
                  Verified Reviews for this Project ({projectReviews.length})
                </h3>
                <span className="text-xs text-slate-400">Live Client Feedback</span>
              </div>

              {reviewsLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : projectReviews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                  <Star className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700">No Reviews Published Yet</p>
                  <p className="mt-1 text-slate-400 max-w-sm mx-auto">
                    {isContractor
                      ? 'The client has not yet published a review for this project. Once submitted, it will appear here.'
                      : 'You have not submitted a review for this project yet. Use the rating form above to leave your feedback.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projectReviews.map((rev) => {
                    const clientName =
                      typeof rev.clientId === 'object' && rev.clientId?.fullName
                        ? rev.clientId.fullName
                        : 'Verified Client';
                    return (
                      <div key={rev._id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-amber-400 font-bold text-xs">
                              {clientName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-xs text-navy-900 block">{clientName}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-4 w-4 ${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
                              />
                            ))}
                            <span className="ml-1 text-xs font-bold text-navy-900">{rev.rating}.0</span>
                          </div>
                        </div>

                        {rev.reviewText && (
                          <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/60">
                            "{rev.reviewText}"
                          </p>
                        )}

                        {rev.tags && rev.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {rev.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-medium text-slate-700"
                              >
                                ✓ {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: 72-HOUR DISPUTE RESOLUTION ───────────────────── */}
        {activeTab === 'disputes' && (
          <div className="mt-6 space-y-4 animate-fadeIn">
            {disputeSuccessMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center justify-between">
                <span>✓ {disputeSuccessMsg}</span>
                <button onClick={() => setDisputeSuccessMsg('')} className="text-emerald-900 hover:opacity-75">✕</button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Active Claims & Settlement Status ({existingDisputes.length})
              </h2>

              <button
                onClick={() => setDisputeOpen(!disputeOpen)}
                className="flex items-center gap-1.5 rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-900 transition-colors shadow-xs cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                {disputeOpen ? 'Cancel' : isContractor ? 'Raise Contractor Claim' : 'Raise Client Claim'}
              </button>
            </div>

          {/* Form to raise a new dispute */}
          {disputeOpen && (
            <form onSubmit={handleDisputeSubmit} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm space-y-4 animate-fadeIn">
              <div className="border-b border-amber-200/60 pb-3">
                <h3 className="font-bold text-amber-950 flex items-center gap-2 text-sm">
                  <BadgeAlert className="h-4 w-4 text-amber-600" />
                  {isContractor ? 'File a Contractor Claim (Protection from Non-Payment & Delays)' : 'File a Client Claim (Quality, Timeline & Materials)'}
                </h3>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  The opposing party will receive an immediate 72-hour timer to accept your remedy or offer a compromise. If they ignore, you win automatically.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dispute Category / Issue Type */}
                <div>
                  <label className="block text-xs font-bold text-navy-900 mb-1">Issue Category</label>
                  <select
                    value={disputeType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDisputeType(val);
                      if (val === 'PAYMENT_WITHHELD') setRemedyType('AUTO_PAYOUT');
                      else if (val === 'SCOPE_CREEP') setRemedyType('MILESTONE_DISCOUNT');
                      else if (val === 'SITE_ACCESS_DELAY') setRemedyType('TIMELINE_EXTENSION');
                      else if (val === 'QUALITY_DEFECT') setRemedyType('REWORK_REQUEST');
                      else if (val === 'WORK_ABANDONED') setRemedyType('CANCEL_EXTRA_SCOPE');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-navy-900 outline-none focus:border-navy-500"
                  >
                    {isContractor ? (
                      <>
                        <option value="PAYMENT_WITHHELD">💰 Client Withholding Payment / Delayed Approval</option>
                        <option value="SCOPE_CREEP">📐 Scope Creep (Unpaid Extra Work Demanded)</option>
                        <option value="SITE_ACCESS_DELAY">🚧 Site Inaccessible / Client Delays</option>
                        <option value="OTHER_CONTRACTOR">⚠️ Other Contractor Grievance</option>
                      </>
                    ) : (
                      <>
                        <option value="QUALITY_DEFECT">🔧 Poor Quality / Work Defect</option>
                        <option value="WORK_ABANDONED">🏃 Contractor Abandoned Site / Stalled</option>
                        <option value="MATERIAL_MISMATCH">📦 Substandard / Wrong Materials Used</option>
                        <option value="OTHER_CLIENT">⚠️ Other Client Grievance</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-navy-900 mb-1">Priority Level</label>
                  <select
                    value={disputePriority}
                    onChange={(e) => setDisputePriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-navy-900 outline-none focus:border-navy-500"
                  >
                    <option value="Medium">Medium Priority (Standard 72h)</option>
                    <option value="High">High Priority (Work Blocked)</option>
                    <option value="Urgent">Urgent Priority (Critical Defect / Financial Stall)</option>
                  </select>
                </div>
              </div>

              {/* Requested Action / Proposed Remedy */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wide">
                  1. What Specific Remedy Do You Demand? (Must be Actionable)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {isContractor ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRemedyType('AUTO_PAYOUT')}
                        className={`p-3 rounded-xl border text-left text-xs transition-all ${
                          remedyType === 'AUTO_PAYOUT'
                            ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-900 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <DollarSign className="h-4 w-4" /> Release Milestone Payout
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">Auto-release payment upon 72h client non-response.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRemedyType('TIMELINE_EXTENSION')}
                        className={`p-3 rounded-xl border text-left text-xs transition-all ${
                          remedyType === 'TIMELINE_EXTENSION'
                            ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-900 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <Calendar className="h-4 w-4" /> Timeline Extension
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">Add penalty-free days to compensate for site blocks.</p>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setRemedyType('REWORK_REQUEST')}
                        className={`p-3 rounded-xl border text-left text-xs transition-all ${
                          remedyType === 'REWORK_REQUEST'
                            ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-900 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <Handshake className="h-4 w-4" /> Free Defect Rework
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">Contractor must fix defect within agreed days.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRemedyType('MILESTONE_DISCOUNT')}
                        className={`p-3 rounded-xl border text-left text-xs transition-all ${
                          remedyType === 'MILESTONE_DISCOUNT'
                            ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-900 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <DollarSign className="h-4 w-4" /> Milestone Price Discount
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">Deduct ₹ compensation from final payout.</p>
                      </button>
                    </>
                  )}
                </div>

                {/* Conditional Amount or Days Input */}
                {(remedyType === 'MILESTONE_DISCOUNT' || remedyType === 'AUTO_PAYOUT') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {remedyType === 'MILESTONE_DISCOUNT' ? 'Requested Discount Amount (₹)' : 'Milestone Payout Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={remedyAmount}
                      onChange={(e) => setRemedyAmount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-navy-900"
                    />
                  </div>
                )}

                {(remedyType === 'REWORK_REQUEST' || remedyType === 'TIMELINE_EXTENSION') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {remedyType === 'REWORK_REQUEST' ? 'Days Allowed for Defect Rework' : 'Extension Days Requested'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={remedyDays}
                      onChange={(e) => setRemedyDays(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-navy-900"
                    />
                  </div>
                )}
              </div>

              {/* Description & Photo Evidence */}
              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">Detailed Description of Defect or Delay</label>
                <textarea
                  rows={3}
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  placeholder="Explain clearly what happened and why this remedy is requested..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-navy-900 outline-none focus:border-navy-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">Evidence Photo / Document URL (Optional)</label>
                <input
                  type="text"
                  value={disputeEvidenceUrl}
                  onChange={(e) => setDisputeEvidenceUrl(e.target.value)}
                  placeholder="Paste URL of site photo showing defect, gate locked, or milestone work..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-navy-900 outline-none focus:border-navy-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeSubmitting || !disputeDesc.trim()}
                  className="rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {disputeSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : 'Launch 72h Settle Claim'}
                </button>
              </div>
            </form>
          )}

          {/* Dispute Cards List */}
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-2xl bg-white border border-slate-200">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : existingDisputes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <p className="font-bold text-slate-700 text-sm">No Active Disputes on this Project</p>
              <p className="mt-1 max-w-sm mx-auto text-slate-400">
                All milestones are proceeding smoothly. If you ever face payment stalls, delays, or defect issues, you can file a 72-hour auto-settling claim anytime.
              </p>
            </div>
          ) : (
            existingDisputes.map((d) => {
              const filerRole = d.raisedByRole || (typeof d.raisedBy === 'object' && (d.raisedBy as any)?.role) || 'CLIENT';
              const isFiler = (typeof d.raisedBy === 'object' && (d.raisedBy as any)?._id === currentUser?._id) || d.raisedBy === currentUser?._id;
              const isRespondent = !isFiler;
              const isActionLoading = respondingActionId === d._id;

              return (
                <div key={d._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  {/* Top Bar: Claim ID, Status, Timer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-navy-900 bg-slate-100 px-2 py-0.5 rounded">
                        #{d._id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {d.issueCategory || d.title}
                      </span>
                      <span className="text-xs text-slate-400">
                        (Filed by <strong className="text-navy-800">{filerRole}</strong>)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <DisputeTimer expiresAt={d.expiresAt} status={d.status} />

                      {/* Status Badge */}
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                        d.status === 'OPEN'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : d.status === 'COMPROMISE_OFFERED'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : d.status === 'RESOLVED_MUTUALLY' || d.status === 'RESOLVED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : d.status === 'RESOLVED_AUTO_TIMEOUT'
                          ? 'bg-purple-50 text-purple-800 border-purple-300'
                          : d.status === 'RESOLVED_CLEAN_BREAK'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                      }`}>
                        {d.status === 'OPEN' ? '72h Clock Running' : d.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Body: Description & Requested Remedy */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="md:col-span-2 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Claim Details</span>
                      <p className="text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/60 whitespace-pre-wrap leading-relaxed">
                        {d.description}
                      </p>
                      {d.evidenceUrls && d.evidenceUrls.length > 0 && (
                        <div className="pt-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Attached Evidence</span>
                          <div className="flex gap-2">
                            {d.evidenceUrls.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-navy-600 underline hover:text-navy-800"
                              >
                                <FileText className="h-3.5 w-3.5" /> Evidence Document #{idx + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">Requested Remedy</span>
                      <p className="text-xs font-bold text-emerald-950">
                        {d.requestedAction?.type === 'AUTO_PAYOUT' && '💰 Immediate Milestone Payout Release'}
                        {d.requestedAction?.type === 'MILESTONE_DISCOUNT' && `💵 ₹${d.requestedAction.amount?.toLocaleString('en-IN')} Milestone Discount`}
                        {d.requestedAction?.type === 'REWORK_REQUEST' && `🔧 ${d.requestedAction.days} Days for Free Defect Rectification`}
                        {d.requestedAction?.type === 'TIMELINE_EXTENSION' && `📅 ${d.requestedAction.days} Days Penalty-Free Extension`}
                        {d.requestedAction?.type === 'CANCEL_EXTRA_SCOPE' && '🚫 Cancel Unpaid Scope Without Penalty'}
                        {!d.requestedAction?.type && 'Direct Resolution Settlement'}
                      </p>
                      <p className="text-[11px] text-emerald-700 leading-snug">
                        {d.status === 'OPEN' && '👉 If respondent does not contest before the 72h timer expires, this remedy is applied automatically.'}
                      </p>
                    </div>
                  </div>

                  {/* Compromise Offer Card (if currently offered) */}
                  {d.status === 'COMPROMISE_OFFERED' && d.proposedSettlement && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                          <Handshake className="h-4 w-4 text-blue-600" />
                          Counter-Compromise Proposed by {d.proposedSettlement.offeredByRole}
                        </span>
                        <span className="text-[10px] text-blue-700">Awaiting Filer's Decision</span>
                      </div>
                      <p className="text-xs text-blue-900 font-medium">"{d.proposedSettlement.message}"</p>
                      {d.proposedSettlement.amount ? (
                        <p className="text-xs text-blue-800 font-bold">Proposed Amount: ₹{d.proposedSettlement.amount.toLocaleString('en-IN')}</p>
                      ) : null}
                      {d.proposedSettlement.days ? (
                        <p className="text-xs text-blue-800 font-bold">Proposed Days: {d.proposedSettlement.days} Days</p>
                      ) : null}

                      {/* If CURRENT USER is the original Filer, give them 1-click accept or clean break */}
                      {isFiler && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-200/60">
                          <button
                            onClick={() => handleAcceptCompromiseOffer(d._id)}
                            disabled={isActionLoading}
                            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Accept Compromise Offer
                          </button>
                          <button
                            onClick={() => handleCleanBreak(d._id)}
                            disabled={isActionLoading}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                          >
                            <Scale className="h-3.5 w-3.5" /> 50/50 Clean Break
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rebuttal Details (if uploaded) */}
                  {d.rebuttal?.statement && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
                      <span className="font-bold text-[10px] uppercase text-slate-500">Counter-Evidence & Statement Submitted</span>
                      <p className="text-slate-700 italic">"{d.rebuttal.statement}"</p>
                      {d.rebuttal.evidenceUrls && d.rebuttal.evidenceUrls.length > 0 && (
                        <div className="pt-1 flex gap-2">
                          {d.rebuttal.evidenceUrls.map((u, i) => (
                            <a key={i} href={u} target="_blank" rel="noreferrer" className="text-navy-600 underline text-[11px]">
                              Counter-Proof #{i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resolved Decision Card */}
                  {(d.status === 'RESOLVED_MUTUALLY' ||
                    d.status === 'RESOLVED_AUTO_TIMEOUT' ||
                    d.status === 'RESOLVED_CLEAN_BREAK' ||
                    d.status === 'RESOLVED') && (
                    <div className={`rounded-xl border p-3 text-xs space-y-1 ${
                      d.status === 'RESOLVED_AUTO_TIMEOUT'
                        ? 'border-purple-200 bg-purple-50 text-purple-900'
                        : d.status === 'RESOLVED_CLEAN_BREAK'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    }`}>
                      <p className="font-bold flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4" />
                        Resolution Recorded ({d.status.replace(/_/g, ' ')})
                      </p>
                      <p className="text-xs">
                        <strong>Rule / Outcome: </strong>
                        {d.autoResolutionDetails?.ruleApplied || d.resolutionNotes || d.adminResolutionNote || 'Resolved without manual intervention.'}
                      </p>
                    </div>
                  )}

                  {/* RESPONDENT ACTION CONTROLS (Zero Admin required) */}
                  {d.status === 'OPEN' && (
                    <div className="border-t border-slate-100 pt-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-navy-900">
                          {isRespondent
                            ? '⚡ Quick Response Actions (You have 72 hours to respond):'
                            : `⚡ Counterpart Action Review (${filerRole === 'CLIENT' ? 'Contractor' : 'Client'} Options):`}
                        </p>
                        {isFiler && (
                          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Test Counterpart Action
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Action 1: Accept Requested Remedy */}
                        <button
                          onClick={() => handleAcceptRemedy(d._id, isFiler)}
                          disabled={isActionLoading}
                          className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition-all"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isRespondent
                            ? 'Accept Requested Remedy'
                            : `Accept Remedy (as ${filerRole === 'CLIENT' ? 'Contractor' : 'Client'})`}
                        </button>

                        {/* Action 2: Propose Compromise */}
                        <button
                          onClick={() => setActiveCompromiseId(activeCompromiseId === d._id ? null : d._id)}
                          disabled={isActionLoading}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 transition-all flex items-center gap-1.5"
                        >
                          <Handshake className="h-3.5 w-3.5" /> Propose 50/50 Compromise
                        </button>

                        {/* Action 3: Upload Rebuttal / Evidence */}
                        <button
                          onClick={() => setActiveRebuttalId(activeRebuttalId === d._id ? null : d._id)}
                          disabled={isActionLoading}
                          className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" /> Counter-Statement
                        </button>
                      </div>

                      {/* Inline Compromise Proposal Form */}
                      {activeCompromiseId === d._id && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3 animate-fadeIn">
                          <span className="font-bold text-xs text-blue-900 block">Offer a Mutual Middle Ground</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Compromise Type</label>
                              <select
                                value={compType}
                                onChange={(e) => setCompType(e.target.value as any)}
                                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-medium text-navy-900"
                              >
                                <option value="SPLIT_50_50">Split Disputed Amount 50/50</option>
                                <option value="PARTIAL_DISCOUNT">Offer Partial Discount (₹)</option>
                                <option value="COUNTER_TIMELINE">Counter with Timeline Extension (Days)</option>
                                <option value="COUNTER_REWORK">Counter with Rework Grace Period (Days)</option>
                              </select>
                            </div>

                            {compType === 'PARTIAL_DISCOUNT' || compType === 'SPLIT_50_50' ? (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Offered Amount (₹)</label>
                                <input
                                  type="number"
                                  value={compAmount}
                                  onChange={(e) => setCompAmount(Number(e.target.value))}
                                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-navy-900"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Days Offered</label>
                                <input
                                  type="number"
                                  value={compDays}
                                  onChange={(e) => setCompDays(Number(e.target.value))}
                                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-navy-900"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Note to Opposing Party</label>
                            <input
                              type="text"
                              value={compNote}
                              onChange={(e) => setCompNote(e.target.value)}
                              placeholder="e.g. I agree to touch up the trim and deduct ₹2,500 if payment is released."
                              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-navy-900"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveCompromiseId(null)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProposeCompromiseSubmit(d._id, isFiler)}
                              disabled={isActionLoading}
                              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              Send Compromise Offer
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Rebuttal Statement Form */}
                      {activeRebuttalId === d._id && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 animate-fadeIn">
                          <span className="font-bold text-xs text-navy-900 block">Submit Counter-Statement & Evidence</span>
                          <textarea
                            rows={2}
                            value={rebuttalStatement}
                            onChange={(e) => setRebuttalStatement(e.target.value)}
                            placeholder="Explain your side of the story (e.g. materials were approved in chat, gate was locked on Monday)..."
                            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-navy-900"
                          />
                          <input
                            type="text"
                            value={rebuttalEvidence}
                            onChange={(e) => setRebuttalEvidence(e.target.value)}
                            placeholder="Optional evidence image URL..."
                            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-navy-900"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveRebuttalId(null)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmitRebuttal(d._id)}
                              disabled={isActionLoading || !rebuttalStatement.trim()}
                              className="rounded-lg bg-navy-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-900"
                            >
                              Submit Counter-Statement
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      </div>

      {/* In-Dashboard Interactive Confirmation Modal (Replaces browser window.confirm) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                  confirmModal.confirmColor === 'emerald'
                    ? 'bg-emerald-100 text-emerald-700'
                    : confirmModal.confirmColor === 'blue'
                    ? 'bg-blue-100 text-blue-700'
                    : confirmModal.confirmColor === 'indigo'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {confirmModal.icon === 'check' && <CheckCircle2 className="h-6 w-6" />}
                {confirmModal.icon === 'handshake' && <Handshake className="h-6 w-6" />}
                {confirmModal.icon === 'scale' && <Scale className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-navy-950">{confirmModal.title}</h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{confirmModal.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={confirmActionLoading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmActionLoading}
                onClick={async () => {
                  setConfirmActionLoading(true);
                  try {
                    await confirmModal.action();
                    setConfirmModal(null);
                  } finally {
                    setConfirmActionLoading(false);
                  }
                }}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${
                  confirmModal.confirmColor === 'emerald'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : confirmModal.confirmColor === 'blue'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : confirmModal.confirmColor === 'indigo'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmActionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                    <span>Processing...</span>
                  </>
                ) : (
                  confirmModal.confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
