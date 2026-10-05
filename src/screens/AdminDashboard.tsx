import { useState, useEffect } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Users,
  ShieldCheck,
  ChevronRight,
  Eye,
  Loader2,
  Trash2,
  Briefcase,
  MapPin,
  FileText,
  Sparkles,
  RefreshCw,
  Zap,
  Cpu,
  Download,
} from 'lucide-react';
import { Logo } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import {
  apiGetAdminContractors,
  apiAdminVerifyContractor,
  apiAdminDeleteContractor,
  apiAdminGetProjects,
  apiAdminDeleteProject,
  apiAdminUpdateDocumentVerification,
  apiAdminGetAiStats,
  apiGetAdminDisputes,
  apiUpdateDisputeStatus,
  apiResolveDispute,
  type AdminContractorItem,
  type ApiProject,
  type AdminAiStats,
  type AiLogFileGroup,
  type ApiDispute,
} from '../lib/api';

type Tab = 'verifications' | 'projects' | 'users' | 'disputes' | 'ai-accuracy';
type VerificationFilter = 'pending' | 'auto-verified' | 'failed' | 'all';

function maskIdentityNumber(num?: string): string {
  if (!num) return 'Not Specified';
  const clean = num.replace(/\s+/g, '');
  if (clean.length === 12) {
    return `XXXX XXXX ${clean.slice(-4)}`;
  }
  if (clean.length === 10) {
    return `XXXXX${clean.slice(5, 9)}X`;
  }
  if (clean.length > 4) {
    return `${'X'.repeat(clean.length - 4)}${clean.slice(-4)}`;
  }
  return num;
}

function downloadLogFile(logGroup: AiLogFileGroup) {
  const headers = ['Time', 'Validation Type', 'User/Project Reference', 'AI Operation', 'Result', 'Status', 'Manual Review Required', 'Details'];
  const rows = logGroup.events.map((ev) => [
    `"${ev.time || ''}"`,
    `"${(ev.validationType || '').replace(/"/g, '""')}"`,
    `"${(ev.userOrProjectRef || '').replace(/"/g, '""')}"`,
    `"${(ev.aiOperation || '').replace(/"/g, '""')}"`,
    `"${(ev.result || '').replace(/"/g, '""')}"`,
    `"${(ev.status || '').replace(/"/g, '""')}"`,
    `"${ev.manualReviewRequired ? 'Yes' : 'No'}"`,
    `"${(ev.details || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${logGroup.fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AdminDashboard({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { locale } = useLocale();
  const [tab, setTab] = useState<Tab>('verifications');
  const [verifFilter, setVerifFilter] = useState<VerificationFilter>('pending');
  const [contractors, setContractors] = useState<AdminContractorItem[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [aiStats, setAiStats] = useState<AdminAiStats | null>(null);
  const [selectedLogGroup, setSelectedLogGroup] = useState<AiLogFileGroup | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<AdminContractorItem | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'contractors' | 'clients'>('all');
  const [disputes, setDisputes] = useState<ApiDispute[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<ApiDispute | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState('RESOLVED_CLIENT_FAVOR');
  const [adminResolutionNote, setAdminResolutionNote] = useState('');
  const [resolutionError, setResolutionError] = useState('');
  const [resolutionSuccessMsg, setResolutionSuccessMsg] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);
  const [disputeSearchQuery, setDisputeSearchQuery] = useState('');
  const [disputeStatusFilter, setDisputeStatusFilter] = useState<string>('ALL');
  const [disputePriorityFilter, setDisputePriorityFilter] = useState<string>('ALL');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [contractorData, projectData, aiStatsData, disputeRes] = await Promise.all([
        apiGetAdminContractors().catch(() => []),
        apiAdminGetProjects().then((r) => r.projects).catch(() => []),
        apiAdminGetAiStats().catch(() => null),
        apiGetAdminDisputes().catch(() => ({ disputes: [] })),
      ]);
      setContractors(contractorData);
      setProjects(projectData);
      setAiStats(aiStatsData);
      setDisputes(Array.isArray(disputeRes) ? disputeRes : disputeRes?.disputes || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleVerify = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      setActionLoading(id);
      await apiAdminVerifyContractor(id, status);
      setContractors((prev) =>
        prev.map((c) =>
          c._id === id
            ? { ...c, kycStatus: status, isVerified: status === 'VERIFIED' }
            : c
        )
      );
      if (selectedContractor && selectedContractor._id === id) {
        setSelectedContractor((prev) => (prev ? { ...prev, kycStatus: status, isVerified: status === 'VERIFIED' } : null));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating verification');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDocVerifyAction = async (
    id: string,
    verificationStatus: 'AUTOMATED_VERIFICATION_PASSED' | 'VERIFICATION_REQUIRED' | 'VERIFICATION_FAILED' | 'REJECTED',
    notes?: string
  ) => {
    try {
      setActionLoading(id);
      const res = await apiAdminUpdateDocumentVerification(id, { verificationStatus, adminNotes: notes });
      const newKycStatus =
        verificationStatus === 'AUTOMATED_VERIFICATION_PASSED' || verificationStatus === 'VERIFIED'
          ? 'VERIFIED'
          : verificationStatus === 'VERIFICATION_FAILED' || verificationStatus === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING';
      setContractors((prev) =>
        prev.map((c) =>
          c._id === id
            ? {
                ...c,
                kycStatus: newKycStatus,
                isVerified: newKycStatus === 'VERIFIED',
                documentVerification: res.profile.documentVerification as any,
              }
            : c
        )
      );
      if (selectedContractor && selectedContractor._id === id) {
        setSelectedContractor((prev) =>
          prev
            ? {
                ...prev,
                kycStatus: newKycStatus,
                isVerified: newKycStatus === 'VERIFIED',
                documentVerification: res.profile.documentVerification as any,
              }
            : null
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating document verification');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteContractor = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete contractor "${name}" and all their bids and profile data?`)) {
      return;
    }
    try {
      setActionLoading(id);
      await apiAdminDeleteContractor(id);
      setContractors((prev) => prev.filter((c) => c._id !== id));
      if (selectedContractor && selectedContractor._id === id) {
        setSelectedContractor(null);
      }
      alert(`Contractor "${name}" has been permanently removed.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting contractor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteProject = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete project "${title}" and all its received bids?`)) {
      return;
    }
    try {
      setActionLoading(id);
      await apiAdminDeleteProject(id);
      setProjects((prev) => prev.filter((p) => p._id !== id));
      alert(`Project "${title}" has been permanently removed.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting project');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkUnderReview = async (disputeId: string) => {
    try {
      setActionLoading(disputeId);
      const res = await apiUpdateDisputeStatus(disputeId, 'UNDER_REVIEW');
      const updated = res.dispute || { ...selectedDispute, status: 'UNDER_REVIEW' };
      setDisputes((prev) => prev.map((d) => (d._id === disputeId ? { ...d, ...updated, status: 'UNDER_REVIEW' } : d)));
      if (selectedDispute && selectedDispute._id === disputeId) {
        setSelectedDispute({ ...selectedDispute, ...updated, status: 'UNDER_REVIEW' });
      }
      setResolutionSuccessMsg('Dispute status updated to UNDER_REVIEW successfully.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating dispute status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;
    if (!adminResolutionNote.trim()) {
      setResolutionError('Admin Resolution Note is mandatory.');
      return;
    }
    setResolutionError('');
    setResolutionSuccessMsg('');
    try {
      setSubmittingResolution(true);
      const targetStatus = (resolutionOutcome === 'REJECTED' || resolutionOutcome === 'Rejected') ? 'REJECTED' : 'RESOLVED';
      const res = await apiResolveDispute(selectedDispute._id, {
        resolutionOutcome,
        adminResolutionNote: adminResolutionNote.trim(),
        status: targetStatus,
      });
      const updated = res.dispute;
      setDisputes((prev) => prev.map((d) => (d._id === selectedDispute._id ? updated : d)));
      setSelectedDispute(updated);
      setResolutionSuccessMsg(`Dispute status updated to ${targetStatus} successfully.`);
    } catch (err) {
      setResolutionError(err instanceof Error ? err.message : 'Failed to submit resolution.');
    } finally {
      setSubmittingResolution(false);
    }
  };

  // Helper functions to categorize verification records cleanly
  const isAutoVerified = (c: AdminContractorItem) => {
    const status = c.documentVerification?.verificationStatus;
    const method = c.documentVerification?.verificationMethod;
    const detailsMatch = c.documentVerification?.detailsMatch ?? c.documentVerification?.details_match;
    return (
      (status === 'VERIFIED' && (detailsMatch === true || !c.documentVerification?.adminReviewed)) ||
      status === 'AUTOMATED_VERIFICATION_PASSED' ||
      (c.isVerified && method === 'AUTOMATED') ||
      (c.isVerified && c.kycStatus === 'VERIFIED' && status !== 'MANUAL_REVIEW' && status !== 'VERIFICATION_REQUIRED')
    );
  };

  const isPendingReview = (c: AdminContractorItem) => {
    const status = c.documentVerification?.verificationStatus;
    return (
      status === 'MANUAL_REVIEW' ||
      status === 'VERIFICATION_REQUIRED' ||
      (!c.isVerified && c.kycStatus === 'PENDING' && status !== 'VERIFIED' && status !== 'AUTOMATED_VERIFICATION_PASSED') ||
      (!c.isVerified && !status && c.kycStatus !== 'REJECTED')
    );
  };

  const isFailedOrRejected = (c: AdminContractorItem) => {
    const status = c.documentVerification?.verificationStatus;
    return c.kycStatus === 'REJECTED' || status === 'VERIFICATION_FAILED' || status === 'REJECTED';
  };

  const pendingReviewCount = contractors.filter(isPendingReview).length;
  const autoVerifiedCount = contractors.filter(isAutoVerified).length;
  const failedCount = contractors.filter(isFailedOrRejected).length;

  const filteredContractorsForVerif = contractors.filter((c) => {
    if (verifFilter === 'pending') return isPendingReview(c);
    if (verifFilter === 'auto-verified') return isAutoVerified(c);
    if (verifFilter === 'failed') return isFailedOrRejected(c);
    return true;
  });

  const getReviewReasonText = (c: AdminContractorItem) => {
    if (c.documentVerification?.verificationReason) {
      return c.documentVerification.verificationReason;
    }
    if (c.documentVerification?.mismatchFlags?.length) {
      return c.documentVerification.mismatchFlags.join('; ');
    }
    if (isAutoVerified(c)) {
      return 'Automatic document & OCR identity match passed.';
    }
    if (c.kycStatus === 'REJECTED') {
      return 'Rejected by Admin manual review.';
    }
    return 'Incomplete documents or format mismatch requiring review.';
  };

  const tabs: { id: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: 'verifications', label: t(locale, 'contractorVerificationTitle') ? t(locale, 'tabVerifications') : 'Verification', icon: ShieldCheck, badge: pendingReviewCount },
    { id: 'projects', label: t(locale, 'tabProjects') || 'All Projects', icon: Briefcase, badge: projects.length },
    { id: 'users', label: t(locale, 'tabUsers') || 'Users & Roles', icon: Users, badge: contractors.length },
    { id: 'disputes', label: t(locale, 'tabDisputes') || 'Disputes', icon: AlertTriangle, badge: disputes.length },
    { id: 'ai-accuracy', label: t(locale, 'tabAiAccuracy') || 'AI Accuracy', icon: Cpu, badge: aiStats?.summary?.totalAiChecks || 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-60 flex-col border-r border-navy-700 bg-navy-600 text-white lg:flex">
        <div className="flex h-16 items-center px-5 border-b border-navy-500/50">
          <Logo size="sm" variant="light" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {tabs.map((tItem) => (
            <button
              key={tItem.id}
              onClick={() => setTab(tItem.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === tItem.id ? 'bg-amber-400 text-navy-950 font-bold shadow-sm' : 'text-white/80 hover:bg-navy-700/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <tItem.icon className="h-5 w-5" strokeWidth={1.75} />
                {tItem.label}
              </div>
              {typeof tItem.badge === 'number' && tItem.badge > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    tab === tItem.id
                      ? 'bg-navy-950 text-amber-400'
                      : 'bg-navy-800 text-amber-400'
                  }`}
                >
                  {tItem.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-navy-500/50 p-3">
          <button
            onClick={() => onNavigate('auth')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-navy-700/60 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" /> {t(locale, 'exitAdmin') || 'Exit Admin'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur-md md:px-6">
          <h1 className="text-lg font-bold text-navy-700">{t(locale, 'adminDashboard') || 'Admin Control Center'}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <LanguageSwitcher variant="header" />
            <span className="hidden md:inline font-medium">{t(locale, 'superAdmin')}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 text-sm font-medium text-white shadow-sm">
              SA
            </div>
          </div>
        </header>

        {/* Mobile tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2 scrollbar-hide lg:hidden">
          {tabs.map((tItem) => (
            <button
              key={tItem.id}
              onClick={() => setTab(tItem.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === tItem.id ? 'bg-navy-600 text-white' : 'text-gray-500'
              }`}
            >
              <tItem.icon className="h-4 w-4" /> {tItem.label}
              {typeof tItem.badge === 'number' && tItem.badge > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] font-bold text-navy-700">
                  {tItem.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          {/* Quick Summary Bar */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t(locale, 'totalContractors')}</p>
              <p className="mt-1 text-2xl font-bold text-navy-700">{contractors.length}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">{t(locale, 'pendingAdminReview')}</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{pendingReviewCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">{t(locale, 'automaticallyVerified')}</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{autoVerifiedCount}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t(locale, 'openDisputes')}</p>
              <p className="mt-1 text-2xl font-bold text-red-500">{disputes.length}</p>
            </div>
          </div>

          {/* TAB 1: Verification (Exception Review) */}
          {tab === 'verifications' && (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700 flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-amber-500" />
                    {t(locale, 'contractorVerificationTitle')}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 max-w-2xl">
                    {t(locale, 'contractorVerificationDesc')}
                  </p>
                </div>
                <button
                  onClick={fetchAdminData}
                  className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-gray-50 shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {t(locale, 'refreshData')}
                </button>
              </div>

              {/* Verification Sub-Filters */}
              <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
                <button
                  onClick={() => setVerifFilter('pending')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    verifFilter === 'pending'
                      ? 'bg-amber-400 text-navy-950 shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>⚠️ {t(locale, 'pendingAdminReview')}</span>
                  <span className="rounded-full bg-navy-950/10 px-1.5 py-0.2 text-[10px]">{pendingReviewCount}</span>
                </button>
                <button
                  onClick={() => setVerifFilter('auto-verified')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    verifFilter === 'auto-verified'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>⚡ {t(locale, 'automaticallyVerified')}</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">{autoVerifiedCount}</span>
                </button>
                <button
                  onClick={() => setVerifFilter('failed')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    verifFilter === 'failed'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>❌ {t(locale, 'rejected')}</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">{failedCount}</span>
                </button>
                <button
                  onClick={() => setVerifFilter('all')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    verifFilter === 'all'
                      ? 'bg-navy-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{t(locale, 'allContractors')}</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">{contractors.length}</span>
                </button>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> {t(locale, 'fetchingVerificationRecords')}
                </div>
              ) : filteredContractorsForVerif.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 bg-white">
                  {verifFilter === 'pending'
                    ? t(locale, 'noPendingVerificationsNotice')
                    : t(locale, 'noContractorRecordsFound')}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">{t(locale, 'colContractor')}</th>
                        <th className="hidden px-4 py-3 md:table-cell">{t(locale, 'colTrade')}</th>
                        <th className="hidden px-4 py-3 sm:table-cell">{t(locale, 'colLocation')}</th>
                        <th className="px-4 py-3">{t(locale, 'colStatus')}</th>
                        <th className="px-4 py-3">{t(locale, 'colReviewReason')}</th>
                        <th className="px-4 py-3 text-right">{t(locale, 'colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContractorsForVerif.map((c) => {
                        const autoVer = isAutoVerified(c);
                        const pendingRev = isPendingReview(c);
                        const reviewReason = getReviewReasonText(c);

                        return (
                          <tr key={c._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-700">
                                  {c.fullName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                  <span className="text-sm font-bold text-navy-700 block">{c.fullName}</span>
                                  <span className="text-xs text-gray-400">{c.phone || c.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-4 py-3.5 text-sm text-gray-600 md:table-cell">
                              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                                {c.trade}
                              </span>
                            </td>
                            <td className="hidden px-4 py-3.5 text-sm text-gray-500 sm:table-cell">
                              {c.city || 'Tamil Nadu'}
                            </td>
                            <td className="px-4 py-3.5">
                              {autoVer ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                  <Zap className="h-3 w-3 text-emerald-500 fill-emerald-500" /> Automatically Verified
                                </span>
                              ) : pendingRev ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                                  <AlertTriangle className="h-3 w-3 text-amber-500" /> Pending Admin Review
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-600 border border-red-200">
                                  <X className="h-3 w-3" /> Rejected
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 max-w-xs">
                              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed" title={reviewReason}>
                                {reviewReason}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedContractor(c)}
                                  className="flex h-8 items-center gap-1 rounded-lg border border-navy-200 bg-navy-50/50 px-2.5 text-xs font-semibold text-navy-700 hover:bg-navy-100 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" /> Review Docs
                                </button>
                                {pendingRev && (
                                  <>
                                    <button
                                      onClick={() => handleVerify(c._id, 'VERIFIED')}
                                      disabled={actionLoading === c._id}
                                      title="Approve Contractor Verification"
                                      className="flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                    >
                                      {actionLoading === c._id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Approve
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleVerify(c._id, 'REJECTED')}
                                      disabled={actionLoading === c._id}
                                      title="Reject Contractor Verification"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
                                    >
                                      <X className="h-4 w-4" strokeWidth={2.5} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: All Projects Module */}
          {tab === 'projects' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700 flex items-center gap-2">
                    <Briefcase className="h-6 w-6 text-navy-600" />
                    {t(locale, 'allPlatformProjects', { count: projects.length.toString() })}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t(locale, 'adminProjectsSubtitle')}
                  </p>
                </div>
                <button
                  onClick={fetchAdminData}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-gray-50 shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {t(locale, 'refreshData')}
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 bg-white">
                  {t(locale, 'noProjectsInDb')}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">{t(locale, 'colProjectTitle')}</th>
                        <th className="px-4 py-3">{t(locale, 'colClient')}</th>
                        <th className="hidden px-4 py-3 md:table-cell">{t(locale, 'colLocationBudget')}</th>
                        <th className="px-4 py-3">{t(locale, 'colStatus')}</th>
                        <th className="px-4 py-3 text-right">{t(locale, 'colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => {
                        const clientName = typeof p.clientId === 'object' && p.clientId ? p.clientId.fullName : 'Client';
                        const clientPhone = typeof p.clientId === 'object' && p.clientId ? p.clientId.phone : '';
                        return (
                          <tr key={p._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3.5">
                              <div>
                                <span className="text-sm font-bold text-navy-700 block">{p.title}</span>
                                <span className="text-xs text-navy-500">{p.category} · {t(locale, 'bidsReceivedCountSimple', { count: (p.bidsCount || 0).toString() })}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-700">
                              <span className="font-semibold block text-navy-800">{clientName}</span>
                              <span className="text-xs text-gray-400">{clientPhone}</span>
                            </td>
                            <td className="hidden px-4 py-3.5 text-sm text-gray-600 md:table-cell">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="h-3 w-3 text-gray-400" /> {p.location}
                              </div>
                              <span className="font-bold text-emerald-700 text-xs">₹{(p.budget || 0).toLocaleString('en-IN')}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  p.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : p.status === 'IN_PROGRESS'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteProject(p._id, p.title)}
                                disabled={actionLoading === p._id}
                                title="Permanently Delete Project"
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> {t(locale, 'delete')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Users & Roles Module */}
          {tab === 'users' && (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700 flex items-center gap-2">
                    <Users className="h-6 w-6 text-navy-600" />
                    {t(locale, 'usersRolesManagement')}
                  </h2>
                  <p className="text-sm text-gray-500">{t(locale, 'usersRolesSubtitle')}</p>
                </div>
                <div className="flex gap-1 rounded-lg bg-gray-100 p-1 self-start sm:self-auto">
                  <button
                    onClick={() => setUserRoleFilter('all')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                      userRoleFilter === 'all' ? 'bg-white text-navy-800 shadow-sm' : 'text-gray-500 hover:text-navy-700'
                    }`}
                  >
                    {t(locale, 'allUsersCount', { count: contractors.length.toString() })}
                  </button>
                  <button
                    onClick={() => setUserRoleFilter('contractors')}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                      userRoleFilter === 'contractors' ? 'bg-white text-navy-800 shadow-sm' : 'text-gray-500 hover:text-navy-700'
                    }`}
                  >
                    {t(locale, 'contractorsTab')}
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">{t(locale, 'colNameContact')}</th>
                      <th className="px-4 py-3">{t(locale, 'colRoleTrade')}</th>
                      <th className="hidden px-4 py-3 md:table-cell">{t(locale, 'colCityArea')}</th>
                      <th className="hidden px-4 py-3 md:table-cell">{t(locale, 'colVerifStatus')}</th>
                      <th className="px-4 py-3 text-right">{t(locale, 'colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractors.map((c) => (
                      <tr key={c._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-700">
                              {c.fullName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <span className="text-sm font-bold text-navy-700 block">{c.fullName}</span>
                              <span className="text-xs text-gray-400">{c.phone || c.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 block w-max border border-amber-200">
                            {t(locale, 'contractor')}
                          </span>
                          <span className="text-xs text-gray-500 mt-1 block">{c.trade}</span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-gray-600 md:table-cell">{c.city || 'Tamil Nadu'}</td>
                        <td className="hidden px-4 py-3.5 text-sm font-semibold md:table-cell">
                          {isAutoVerified(c) ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <Zap className="h-3 w-3 fill-emerald-500" /> {t(locale, 'autoVerified')}
                            </span>
                          ) : c.isVerified ? (
                            <span className="text-emerald-600 font-bold">{t(locale, 'verifiedCheck')}</span>
                          ) : c.kycStatus === 'REJECTED' ? (
                            <span className="text-red-500 font-bold">❌ {t(locale, 'rejected')}</span>
                          ) : (
                            <span className="text-amber-600 font-bold">{t(locale, 'pendingReview')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteContractor(c._id, c.fullName)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> {t(locale, 'deleteUser')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Disputes Module */}
          {tab === 'disputes' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700 flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                    {t(locale, 'projectDisputes', { count: disputes.length.toString() }) || `Project Disputes (${disputes.length})`}
                  </h2>
                  <p className="text-xs text-gray-500">Inspect client and contractor disputes, review evidence, and record binding administrative decisions.</p>
                </div>
                <button
                  onClick={fetchAdminData}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-gray-50 shadow-sm transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh Disputes
                </button>
              </div>

              {/* Status & Priority Filter Controls */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                  <input
                    type="text"
                    value={disputeSearchQuery}
                    onChange={(e) => setDisputeSearchQuery(e.target.value)}
                    placeholder="Search by ID, project, client, contractor, or issue..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-3 pr-8 py-2 text-xs text-navy-800 outline-none focus:border-navy-400 focus:bg-white"
                  />
                  {disputeSearchQuery && (
                    <button
                      onClick={() => setDisputeSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex w-full md:w-auto flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span>Status:</span>
                    <select
                      value={disputeStatusFilter}
                      onChange={(e) => setDisputeStatusFilter(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-800 outline-none focus:border-navy-400"
                    >
                      <option value="ALL">All Statuses ({disputes.length})</option>
                      <option value="OPEN">Open ({disputes.filter((d) => d.status === 'OPEN').length})</option>
                      <option value="UNDER_REVIEW">Under Review ({disputes.filter((d) => d.status === 'UNDER_REVIEW').length})</option>
                      <option value="RESOLVED">Resolved ({disputes.filter((d) => d.status === 'RESOLVED').length})</option>
                      <option value="REJECTED">Rejected ({disputes.filter((d) => d.status === 'REJECTED').length})</option>
                      <option value="CLOSED">Closed ({disputes.filter((d) => d.status === 'CLOSED').length})</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span>Priority:</span>
                    <select
                      value={disputePriorityFilter}
                      onChange={(e) => setDisputePriorityFilter(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-800 outline-none focus:border-navy-400"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Disputes List */}
              {disputes.filter((d) => {
                const statusMatch = disputeStatusFilter === 'ALL' || d.status?.toUpperCase() === disputeStatusFilter.toUpperCase();
                const priorityMatch = disputePriorityFilter === 'ALL' || (d.priority && d.priority.toLowerCase() === disputePriorityFilter.toLowerCase());
                const clientName = typeof d.clientId === 'object' && d.clientId?.fullName ? d.clientId.fullName : '';
                const contractorName = typeof d.contractorId === 'object' && ((d.contractorId as any)?.companyName || d.contractorId?.fullName) ? ((d.contractorId as any).companyName || d.contractorId.fullName) : '';
                const projectTitle = typeof d.projectId === 'object' && d.projectId?.title ? d.projectId.title : '';
                const category = d.issueCategory || (d as any).reason || '';
                const desc = d.description || '';
                const q = disputeSearchQuery.toLowerCase().trim();
                const searchMatch = !q || d._id.toLowerCase().includes(q) || clientName.toLowerCase().includes(q) || contractorName.toLowerCase().includes(q) || projectTitle.toLowerCase().includes(q) || category.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
                return statusMatch && priorityMatch && searchMatch;
              }).length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-navy-800">No disputes found</h3>
                  <p className="mt-1 text-xs text-gray-500">There are currently no dispute records matching your filter criteria.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disputes.filter((d) => {
                    const statusMatch = disputeStatusFilter === 'ALL' || d.status?.toUpperCase() === disputeStatusFilter.toUpperCase();
                    const priorityMatch = disputePriorityFilter === 'ALL' || (d.priority && d.priority.toLowerCase() === disputePriorityFilter.toLowerCase());
                    const clientName = typeof d.clientId === 'object' && d.clientId?.fullName ? d.clientId.fullName : '';
                    const contractorName = typeof d.contractorId === 'object' && ((d.contractorId as any)?.companyName || d.contractorId?.fullName) ? ((d.contractorId as any).companyName || d.contractorId.fullName) : '';
                    const projectTitle = typeof d.projectId === 'object' && d.projectId?.title ? d.projectId.title : '';
                    const category = d.issueCategory || (d as any).reason || '';
                    const desc = d.description || '';
                    const q = disputeSearchQuery.toLowerCase().trim();
                    const searchMatch = !q || d._id.toLowerCase().includes(q) || clientName.toLowerCase().includes(q) || contractorName.toLowerCase().includes(q) || projectTitle.toLowerCase().includes(q) || category.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
                    return statusMatch && priorityMatch && searchMatch;
                  }).map((d) => {
                    const clientName = typeof d.clientId === 'object' && d.clientId?.fullName ? d.clientId.fullName : 'Client';
                    const contractorName = typeof d.contractorId === 'object' && ((d.contractorId as any)?.companyName || d.contractorId?.fullName) ? ((d.contractorId as any).companyName || d.contractorId.fullName) : 'Contractor';
                    const projectTitle = typeof d.projectId === 'object' && d.projectId?.title ? d.projectId.title : 'Project';
                    const category = d.issueCategory || (d as any).reason || 'General Dispute';
                    const formattedDate = new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    const isRaisedByClient = typeof d.raisedBy === 'object' ? d.raisedBy?._id === (typeof d.clientId === 'object' ? d.clientId._id : d.clientId) : d.raisedBy === (typeof d.clientId === 'object' ? d.clientId._id : d.clientId);

                    return (
                      <div key={d._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-300 transition-all">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-navy-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                #DISP-{d._id.slice(-6).toUpperCase()}
                              </span>
                              <span className="text-sm font-bold text-navy-900">{category}</span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  d.status === 'OPEN'
                                    ? 'bg-red-50 text-red-600 border border-red-200'
                                    : d.status === 'UNDER_REVIEW'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : d.status === 'RESOLVED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : d.status === 'REJECTED'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-gray-100 text-gray-700 border border-gray-300'
                                }`}
                              >
                                {d.status}
                              </span>
                              {d.priority && (
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  d.priority === 'High' || d.priority === 'Urgent'
                                    ? 'bg-red-100 text-red-800'
                                    : d.priority === 'Medium'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {d.priority} Priority
                                </span>
                              )}
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Raised by {isRaisedByClient ? 'Client' : 'Contractor'}
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-navy-800">
                              Project: <span className="text-navy-900">{projectTitle}</span>
                            </p>

                            <p className="text-xs text-gray-600">
                              Client: <span className="font-semibold text-navy-800">{clientName}</span> | Contractor: <span className="font-semibold text-navy-800">{contractorName}</span>
                            </p>

                            {d.title && (
                              <p className="text-xs font-bold text-navy-900 mt-0.5">
                                Title: {d.title}
                              </p>
                            )}

                            <p className="text-xs text-gray-500 line-clamp-2 italic">
                              "{d.description}"
                            </p>

                            <p className="text-[11px] text-gray-400 pt-0.5">
                              Filed on {formattedDate}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                            <button
                              onClick={() => {
                                setSelectedDispute(d);
                                setResolutionOutcome(d.resolutionOutcome || 'RESOLVED_CLIENT_FAVOR');
                                setAdminResolutionNote(d.adminResolutionNote || d.resolutionNotes || '');
                                setResolutionError('');
                                setResolutionSuccessMsg('');
                              }}
                              className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-bold text-navy-800 hover:bg-gray-50 shadow-sm transition-colors flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5 text-navy-600" /> View Details
                            </button>

                            {d.status === 'OPEN' && (
                              <button
                                onClick={() => handleMarkUnderReview(d._id)}
                                disabled={actionLoading === d._id}
                                className="rounded-lg bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200 border border-amber-300 shadow-sm transition-colors"
                              >
                                {actionLoading === d._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark Under Review'}
                              </button>
                            )}

                            {d.status !== 'RESOLVED' && d.status !== 'REJECTED' && d.status !== 'CLOSED' && (
                              <button
                                onClick={() => {
                                  setSelectedDispute(d);
                                  setResolutionOutcome('RESOLVED_CLIENT_FAVOR');
                                  setAdminResolutionNote(d.adminResolutionNote || d.resolutionNotes || '');
                                  setResolutionError('');
                                  setResolutionSuccessMsg('');
                                }}
                                className="rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-bold text-navy-950 hover:bg-amber-300 shadow-sm transition-colors"
                              >
                                Resolve / Action
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AI Accuracy Module */}
          {tab === 'ai-accuracy' && (
            <div className="space-y-8">
              {/* Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700 flex items-center gap-2">
                    <Cpu className="h-6 w-6 text-indigo-600" />
                    {t(locale, 'aiAccuracyTitle')}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 max-w-2xl">
                    {t(locale, 'aiAccuracySubtitle')}
                  </p>
                </div>
                <button
                  onClick={fetchAdminData}
                  className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-gray-50 shadow-sm transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {t(locale, 'refreshData')}
                </button>
              </div>

              {/* SECTION 1: AI VALIDATION OVERVIEW */}
              <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy-700 border-b border-gray-100 pb-2">
                  {t(locale, 'aiValidationOverview')}
                </h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t(locale, 'totalAiChecks')}</p>
                    <p className="mt-2 text-3xl font-extrabold text-navy-800">
                      {aiStats?.summary?.totalAiChecks ?? 0}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">{t(locale, 'completedCount')}</p>
                    <p className="mt-2 text-3xl font-extrabold text-emerald-700">
                      {aiStats?.summary?.completed ?? 0}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">{t(locale, 'needsReview')}</p>
                    <p className="mt-2 text-3xl font-extrabold text-amber-700">
                      {aiStats?.summary?.needsReview ?? 0}
                    </p>
                  </div>

                  <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">{t(locale, 'failedCount')}</p>
                    <p className="mt-2 text-3xl font-extrabold text-red-700">
                      {aiStats?.summary?.failed ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: MODEL PERFORMANCE */}
              <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy-700 border-b border-gray-100 pb-2">
                  {t(locale, 'modelPerformance')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* AI Image Detection */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h4 className="text-sm font-bold text-navy-800 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                        {t(locale, 'aiImageDetection')}
                      </h4>
                      <span className="text-[11px] font-semibold text-gray-400">Groq Vision</span>
                    </div>

                    {aiStats?.modelPerformance?.aiImageDetection?.hasGroundTruth && aiStats.modelPerformance.aiImageDetection.metrics ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <span className="text-gray-400 font-medium block">{t(locale, 'accuracy')}</span>
                          <span className="text-base font-bold text-navy-800">{aiStats.modelPerformance.aiImageDetection.metrics.accuracy}%</span>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <span className="text-gray-400 font-medium block">{t(locale, 'precision')}</span>
                          <span className="text-base font-bold text-navy-800">{aiStats.modelPerformance.aiImageDetection.metrics.precision}%</span>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <span className="text-gray-400 font-medium block">{t(locale, 'recall')}</span>
                          <span className="text-base font-bold text-navy-800">{aiStats.modelPerformance.aiImageDetection.metrics.recall}%</span>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <span className="text-gray-400 font-medium block">{t(locale, 'f1Score')}</span>
                          <span className="text-base font-bold text-navy-800">{aiStats.modelPerformance.aiImageDetection.metrics.f1Score}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3.5 text-xs text-gray-500">
                        <p className="font-semibold text-navy-700">{t(locale, 'noAccuracyData')}</p>
                      </div>
                    )}
                  </div>

                  {/* Document Verification */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h4 className="text-sm font-bold text-navy-800 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        {t(locale, 'documentVerification')}
                      </h4>
                      <span className="text-[11px] font-semibold text-gray-400">Identity OCR</span>
                    </div>

                    {aiStats?.modelPerformance?.documentVerification?.hasGroundTruth && aiStats.modelPerformance.documentVerification.metrics ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <span className="text-gray-400 font-medium block">{t(locale, 'accuracy')}</span>
                          <span className="text-base font-bold text-navy-800">{aiStats.modelPerformance.documentVerification.metrics.accuracy}%</span>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <span className="text-gray-400 font-medium block">{t(locale, 'precision')}</span>
                          <span className="text-base font-bold text-navy-800">{aiStats.modelPerformance.documentVerification.metrics.precision}%</span>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <span className="text-gray-400 font-medium block">{t(locale, 'recall')}</span>
                          <span className="text-base font-bold text-navy-800">{aiStats.modelPerformance.documentVerification.metrics.recall}%</span>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2.5">
                          <span className="text-gray-400 font-medium block">{t(locale, 'f1Score')}</span>
                          <span className="text-base font-bold text-navy-800">{aiStats.modelPerformance.documentVerification.metrics.f1Score}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3.5 text-xs text-gray-500">
                        <p className="font-semibold text-navy-700">{t(locale, 'noAccuracyData')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: RECENT AI VALIDATION & DETECTION LOGS */}
              <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-navy-700">
                    {t(locale, 'recentAiLogs')}
                  </h3>
                  {aiStats?.logsByDate && aiStats.logsByDate.length > 3 && (
                    <button
                      onClick={() => setShowAllLogs(!showAllLogs)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {showAllLogs ? t(locale, 'showLess') : t(locale, 'viewAllLogs', { count: aiStats.logsByDate.length.toString() })}
                    </button>
                  )}
                </div>

                {!aiStats?.logsByDate || aiStats.logsByDate.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 bg-white">
                    {t(locale, 'noLogFiles')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(showAllLogs ? aiStats.logsByDate : aiStats.logsByDate.slice(0, 3)).map((logFile) => (
                      <div
                        key={logFile.fileName}
                        className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 shadow-sm hover:border-gray-300 transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-navy-900 font-mono">{logFile.fileName}</h4>
                              <p className="mt-0.5 text-xs text-gray-500 font-medium">{t(locale, 'validationEventsCount', { count: logFile.eventCount.toString() })}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 border-t border-gray-200/60 pt-3">
                          <button
                            onClick={() => setSelectedLogGroup(logFile)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-navy-800 hover:bg-gray-100 shadow-sm transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5 text-navy-600" /> {t(locale, 'open')}
                          </button>
                          <button
                            onClick={() => downloadLogFile(logFile)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" /> {t(locale, 'download')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Document Review Modal */}
      {selectedContractor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-left animate-scaleIn">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-navy-800">{selectedContractor.fullName}</h3>
                <p className="text-xs text-gray-500">{selectedContractor.phone || selectedContractor.email} · {selectedContractor.trade}</p>
              </div>
              <button onClick={() => setSelectedContractor(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Automatic Verification Status Banner */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{t(locale, 'automaticVerificationResult')}</span>
                  {isAutoVerified(selectedContractor) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300">
                      <Zap className="h-3 w-3 fill-emerald-600" /> {t(locale, 'passedAutomatically')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">
                      <AlertTriangle className="h-3 w-3" /> {t(locale, 'flaggedForManualReview')}
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium text-navy-800">
                  <span className="font-bold">{t(locale, 'reasonLabel')}</span> {getReviewReasonText(selectedContractor)}
                </p>

                {selectedContractor.documentVerification?.mismatchFlags && selectedContractor.documentVerification.mismatchFlags.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200">
                    <p className="font-bold mb-1">{t(locale, 'detectedDiscrepancies')}</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {selectedContractor.documentVerification.mismatchFlags.map((flag: string, i: number) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Submitted vs Extracted Information Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-700 mb-2">
                  {t(locale, 'extractedVsProfile')}
                </h4>
                <div className="rounded-xl bg-white border border-gray-200 text-xs divide-y divide-gray-100 shadow-sm">
                  <div className="p-3 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t(locale, 'submittedName')}</span>
                      <span className="font-bold text-navy-800">{selectedContractor.fullName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t(locale, 'extractedName')}</span>
                      <span className="font-bold text-navy-800">
                        {selectedContractor.documentVerification?.aadhaarExtractedName || selectedContractor.documentVerification?.panExtractedCompanyName || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t(locale, 'enteredAadhaar')}</span>
                      <span className="font-mono font-bold text-navy-900">
                        {maskIdentityNumber(selectedContractor.aadhaarNumber || selectedContractor.kycDocumentNumber)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t(locale, 'extractedAadhaar')}</span>
                      <span className="font-mono font-bold text-navy-900">
                        {maskIdentityNumber(selectedContractor.documentVerification?.aadhaarExtractedNumber)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t(locale, 'enteredPan')}</span>
                      <span className="font-mono font-bold text-navy-900">
                        {maskIdentityNumber(selectedContractor.companyPanNumber)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t(locale, 'extractedPan')}</span>
                      <span className="font-mono font-bold text-navy-900">
                        {maskIdentityNumber(selectedContractor.documentVerification?.panExtractedNumber)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-medium">{t(locale, 'formatVerificationChecks')}</span>
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold ${selectedContractor.documentVerification?.aadhaarFormatValid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        Aadhaar: {selectedContractor.documentVerification?.aadhaarFormatValid ? '✓ Valid 12-digit' : '⚠️ Format Check Needed'}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold ${selectedContractor.documentVerification?.panFormatValid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        PAN: {selectedContractor.documentVerification?.panFormatValid ? '✓ Valid 10-char' : '⚠️ Format Check Needed'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uploaded Document Links */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-700 mb-2">{t(locale, 'submittedDocAttachments')}</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedContractor.aadhaarDocumentUrl ? (
                    <a
                      href={selectedContractor.aadhaarDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-sm"
                    >
                      <FileText className="h-4 w-4" /> {t(locale, 'viewAadhaarDoc')}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400 italic">{t(locale, 'noAadhaarAttached')}</span>
                  )}
                  {selectedContractor.companyPanDocumentUrl && (
                    <a
                      href={selectedContractor.companyPanDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-sm"
                    >
                      <FileText className="h-4 w-4" /> {t(locale, 'viewPanDoc')}
                    </a>
                  )}
                </div>
              </div>

              {/* Admin Decision & Actions */}
              <div className="mt-6 flex flex-wrap items-center justify-between border-t border-gray-100 pt-4 gap-2">
                <button
                  onClick={() => handleDeleteContractor(selectedContractor._id, selectedContractor.fullName)}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t(locale, 'deleteContractor')}
                </button>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDocVerifyAction(selectedContractor._id, 'REJECTED', 'Admin manual verification rejected')}
                    disabled={actionLoading === selectedContractor._id}
                    className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 shadow-sm"
                  >
                    {t(locale, 'rejectVerification')}
                  </button>
                  <button
                    onClick={() => handleDocVerifyAction(selectedContractor._id, 'VERIFIED', '✓ Verification successful. Your documents have been verified.')}
                    disabled={actionLoading === selectedContractor._id}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                  >
                    {actionLoading === selectedContractor._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4" strokeWidth={2.5} /> {t(locale, 'approveAndMarkVerified')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Readable Log File View Modal */}
      {selectedLogGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-left animate-scaleIn">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-navy-800 font-mono flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  {selectedLogGroup.fileName}
                </h3>
                <p className="text-xs text-gray-500">{t(locale, 'validationEventsOnDate', { count: selectedLogGroup.eventCount.toString(), date: selectedLogGroup.date })}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadLogFile(selectedLogGroup)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> {t(locale, 'downloadCsv')}
                </button>
                <button
                  onClick={() => setSelectedLogGroup(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {selectedLogGroup.events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400">
                  {t(locale, 'noLogEvents')}
                </div>
              ) : (
                selectedLogGroup.events.map((ev) => (
                  <div key={ev.id} className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 text-xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-navy-800 bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px]">
                          {ev.time || '12:00'}
                        </span>
                        <span className="font-bold text-navy-900">{ev.validationType}</span>
                        <span className="text-gray-400 hidden sm:inline">·</span>
                        <span className="text-navy-700 font-semibold">{ev.userOrProjectRef}</span>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold self-start sm:self-auto ${
                          ev.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : ev.status === 'Needs Review'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}
                      >
                        Status: {ev.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-gray-600 pt-1">
                      <div>
                        <span className="text-gray-400 block font-semibold text-[10px] uppercase">{t(locale, 'aiOperation')}</span>
                        <span className="font-medium text-navy-800">{ev.aiOperation}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold text-[10px] uppercase">{t(locale, 'result')}</span>
                        <span
                          className={`font-bold ${
                            ev.result === 'Valid' || ev.result === 'Match'
                              ? 'text-emerald-700'
                              : ev.result === 'Potentially AI-generated'
                              ? 'text-purple-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {ev.result}
                        </span>
                      </div>
                    </div>

                    {ev.details && (
                      <div className="pt-2 text-gray-600 text-[11px] border-t border-gray-200/70">
                        <span className="font-bold text-navy-700">{t(locale, 'detailsLabel')} </span>
                        {ev.details}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dispute Details & Resolution Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-navy-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Dispute Details #{selectedDispute._id?.slice(-6).toUpperCase()}
                </h3>
                <p className="text-xs text-gray-500">Review project dispute, evidence, and record resolution decision.</p>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3 border border-gray-200/80">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Current Status</span>
                    <span className={`inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      selectedDispute.status === 'OPEN'
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : selectedDispute.status === 'UNDER_REVIEW'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {selectedDispute.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Priority</span>
                    <span className={`inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      selectedDispute.priority === 'Urgent'
                        ? 'bg-red-600 text-white'
                        : selectedDispute.priority === 'High'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      {selectedDispute.priority || 'Medium'}
                    </span>
                  </div>
                </div>
                {selectedDispute.status === 'OPEN' && (
                  <button
                    type="button"
                    onClick={() => handleMarkUnderReview(selectedDispute._id)}
                    disabled={actionLoading === selectedDispute._id}
                    className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-navy-950 hover:bg-amber-400 transition-colors shadow-xs disabled:opacity-50"
                  >
                    Mark Under Review
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-100">
                  <span className="text-gray-400 block font-semibold text-[10px] uppercase">Client</span>
                  <span className="font-bold text-navy-800">
                    {typeof selectedDispute.clientId === 'object' ? selectedDispute.clientId.fullName : 'Client'}
                  </span>
                  <span className="block text-gray-500 text-[11px]">
                    {typeof selectedDispute.clientId === 'object' ? selectedDispute.clientId.email : ''}
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-100">
                  <span className="text-gray-400 block font-semibold text-[10px] uppercase">Contractor</span>
                  <span className="font-bold text-navy-800">
                    {typeof selectedDispute.contractorId === 'object' ? (selectedDispute.contractorId.companyName || selectedDispute.contractorId.fullName) : 'Contractor'}
                  </span>
                  <span className="block text-gray-500 text-[11px]">
                    {typeof selectedDispute.contractorId === 'object' ? selectedDispute.contractorId.email : ''}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-100">
                  <span className="text-gray-400 block font-semibold text-[10px] uppercase">Associated Project</span>
                  <span className="font-bold text-navy-800">
                    {typeof selectedDispute.projectId === 'object' ? selectedDispute.projectId.title : 'Project'}
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-100">
                  <span className="text-gray-400 block font-semibold text-[10px] uppercase">Dispute Raised By</span>
                  <span className="font-bold text-navy-800">
                    {typeof selectedDispute.raisedBy === 'object'
                      ? `${selectedDispute.raisedBy.fullName} (${selectedDispute.raisedBy.role || 'User'})`
                      : (selectedDispute.raisedBy || 'Client')}
                  </span>
                </div>
              </div>

              {selectedDispute.title && (
                <div className="space-y-1 text-xs">
                  <span className="text-gray-500 font-semibold block">Dispute Title</span>
                  <p className="font-bold text-navy-900 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                    {selectedDispute.title}
                  </p>
                </div>
              )}

              <div className="space-y-1 text-xs">
                <span className="text-gray-500 font-semibold block">Dispute Category / Reason</span>
                <p className="font-bold text-navy-800 bg-amber-50/70 p-2.5 rounded-lg border border-amber-100">
                  {selectedDispute.issueCategory || (selectedDispute as any).reason || 'General Dispute'}
                </p>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-gray-500 font-semibold block">Full Description & Claims</span>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap leading-relaxed">
                  {selectedDispute.description}
                </p>
              </div>

              {selectedDispute.evidenceUrls && selectedDispute.evidenceUrls.length > 0 && (
                <div className="space-y-1 text-xs">
                  <span className="text-gray-500 font-semibold block">Evidence & Attachments</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedDispute.evidenceUrls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                      >
                        <FileText className="h-3.5 w-3.5" /> Attachment #{idx + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedDispute.status === 'RESOLVED' || selectedDispute.status === 'REJECTED' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2 text-xs">
                  <p className="font-bold text-emerald-900 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Dispute Arbitrated & Finalized
                  </p>
                  <p className="text-emerald-800"><strong>Outcome:</strong> {selectedDispute.resolutionOutcome || 'Resolved'}</p>
                  <p className="text-emerald-800"><strong>Admin Note:</strong> {selectedDispute.adminResolutionNote || selectedDispute.resolutionNotes || 'N/A'}</p>
                  {selectedDispute.resolvedAt && (
                    <p className="text-[11px] text-emerald-700 italic">Resolved on: {new Date(selectedDispute.resolvedAt).toLocaleString()}</p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleResolveDisputeSubmit} className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider">Record Resolution Decision</h4>
                  {resolutionError && (
                    <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded border border-red-200">{resolutionError}</p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-navy-700 mb-1">Resolution Outcome</label>
                    <select
                      value={resolutionOutcome}
                      onChange={(e) => setResolutionOutcome(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-medium text-navy-800 outline-none focus:border-navy-400"
                    >
                      <option value="Resolved in Client's Favor">Resolved in Client's Favor</option>
                      <option value="Resolved in Contractor's Favor">Resolved in Contractor's Favor</option>
                      <option value="Mutually Resolved">Mutually Resolved</option>
                      <option value="REJECTED">Reject Dispute</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-700 mb-1">
                      Admin Resolution Note <span className="text-red-500">*</span> (Mandatory Audit Note)
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Enter detailed audit rationale, agreement terms, or resolution reasoning..."
                      value={adminResolutionNote}
                      onChange={(e) => setAdminResolutionNote(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 p-2.5 text-xs text-navy-800 placeholder-gray-400 outline-none focus:border-navy-400"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDispute(null)}
                      className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingResolution}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-bold text-navy-950 hover:bg-amber-300 shadow-sm disabled:opacity-50"
                    >
                      {submittingResolution ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Finalize Resolution'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
