import { useState, useEffect } from 'react';
import { IndianRupee, Briefcase, Star, CheckCircle2, QrCode, MapPin, ArrowRight, Upload, ShieldAlert, BadgeCheck, Loader2 } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton } from '../components/ui';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiGetContractorDashboardStats, apiGetProjectFeed, apiGetMyBids, type ContractorDashboardStats, type ApiProject, type ApiBidItem } from '../lib/api';

export function ContractorDashboard({
  onNavigate,
}: {
  onNavigate: (id: ScreenId, projectId?: string) => void;
}) {
  const { locale } = useLocale();
  const [stats, setStats] = useState<ContractorDashboardStats | null>(null);
  const [jobMatches, setJobMatches] = useState<ApiProject[]>([]);
  const [myBids, setMyBids] = useState<ApiBidItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [statsData, feedData, bidsData] = await Promise.all([
          apiGetContractorDashboardStats().catch(() => null),
          apiGetProjectFeed().catch(() => ({ projects: [] })),
          apiGetMyBids().catch(() => ({ bids: [] })),
        ]);

        if (statsData) setStats(statsData);
        if (feedData?.projects?.length) {
          setJobMatches(feedData.projects);
        } else if (statsData?.openOpportunities?.length) {
          setJobMatches(statsData.openOpportunities);
        }
        if (bidsData?.bids) {
          setMyBids(bidsData.bids);
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const contractorName = stats?.fullName || 'Contractor';
  const isVerified = stats?.isVerified || stats?.kycStatus === 'VERIFIED';
  const kycStatus = stats?.kycStatus || 'PENDING';

  const statCards = [
    {
      label: t(locale, 'earnings') || 'Earnings (This Month)',
      value: loading ? '...' : `₹${(stats?.earnings ?? 0).toLocaleString('en-IN')}`,
      icon: IndianRupee,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: t(locale, 'activeJobs') || 'Active Jobs',
      value: loading ? '...' : String(stats?.activeJobs ?? 0),
      icon: Briefcase,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: t(locale, 'rating') || 'Rating',
      value: loading
        ? '...'
        : stats && stats.rating > 0
        ? `${stats.rating.toFixed(1)} ★`
        : '0.0',
      icon: Star,
      color: 'text-navy-600',
      bg: 'bg-navy-50',
    },
    {
      label: t(locale, 'completed') || 'Completed',
      value: loading ? '...' : String(stats?.completedJobs ?? 0),
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <TopNav
        avatarName={contractorName}
        avatarSrc="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150"
        onNavigate={onNavigate}
      />
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-navy-700">
                {t(locale, 'welcomeContractor') || 'Welcome'}, {contractorName}
              </h1>
              {isVerified ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" /> Verified Pro
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                  KYC Pending Review
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {jobMatches.length > 0
                ? `You have ${jobMatches.length} new construction ${jobMatches.length === 1 ? 'job opportunity' : 'job opportunities'} in your area.`
                : 'Looking for matching projects in Coimbatore and surrounding areas...'}
            </p>
          </div>

          <button
            onClick={() => onNavigate('contractor-profile')}
            className="rounded-lg border border-navy-200 px-3.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50"
          >
            View / Edit Profile
          </button>
        </div>

        {/* KYC Alert if Pending or Rejected */}
        {!isVerified && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {kycStatus === 'REJECTED'
                    ? 'KYC Documents Need Attention'
                    : 'KYC Verification Under Review'}
                </p>
                <p className="text-xs text-amber-700">
                  {kycStatus === 'REJECTED'
                    ? 'Your documents were rejected. Please update them in your profile.'
                    : 'Admin is reviewing your documents. Once verified, you get top priority in AI client recommendations.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('contractor-profile')}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
            >
              Check KYC
            </button>
          </div>
        )}

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-xl bg-gray-100 p-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} strokeWidth={1.75} />
              </div>
              <p className="mt-3 text-2xl font-bold text-navy-700">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* My Submitted Bids & Quotations */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              My Submitted Bids & Quotations
            </h2>
            {myBids.length > 0 && (
              <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-700">
                {myBids.length} {myBids.length === 1 ? 'Bid' : 'Bids'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex min-h-[100px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : myBids.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 bg-gray-50/50">
              <p>You haven't submitted any quotations yet.</p>
              <p className="mt-1 text-xs text-gray-400">Explore open construction projects below and submit your competitive quotes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myBids.map((bid) => {
                const projectObj = typeof bid.projectId === 'object' && bid.projectId !== null ? bid.projectId : null;
                const projectTitle = projectObj?.title || 'Construction Project';
                const projectLoc = projectObj?.location || 'Coimbatore';
                const projectCat = projectObj?.category || 'Construction';
                const clientObj = projectObj && typeof (projectObj as any).clientId === 'object' ? (projectObj as any).clientId : null;
                const clientName = clientObj?.fullName || (projectObj as any)?.clientName || '';
                const submittedDate = new Date(bid.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                const isAccepted = bid.status === 'ACCEPTED';
                const isRejected = bid.status === 'REJECTED';
                const isSubmitted = bid.status === 'SUBMITTED' || bid.status === 'PENDING';

                return (
                  <div
                    key={bid._id}
                    className={`rounded-xl border p-4 transition-shadow ${
                      isAccepted
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : isRejected
                        ? 'border-red-200 bg-red-50/30'
                        : 'border-amber-200 bg-amber-50/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-navy-700">{projectTitle}</h3>
                          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                            {projectCat}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">
                          {clientName ? (
                            <span className="font-medium text-navy-800">
                              Posted by: <span className="font-bold text-navy-900">{clientName}</span> ·{' '}
                            </span>
                          ) : null}
                          <span>{projectLoc}</span> · <span>Submitted on {submittedDate}</span>
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Accepted
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800 border border-red-300">
                            <span className="h-2 w-2 rounded-full bg-red-500" /> Rejected
                          </span>
                        )}
                        {isSubmitted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-300">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Submitted
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Proposal & Quote info */}
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white p-3 text-xs md:grid-cols-4">
                      <div>
                        <span className="text-gray-400">Your Quotation</span>
                        <p className="font-bold text-navy-700">₹{bid.amount.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Timeline</span>
                        <p className="font-medium text-navy-700">{bid.estimatedDays} Days</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Materials</span>
                        <p className="font-medium text-navy-700">{bid.materialsIncluded ? 'Included' : 'Labor Only'}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Warranty</span>
                        <p className="font-medium text-navy-700">{bid.warranty || '1 Year'}</p>
                      </div>
                    </div>

                    {bid.proposalMessage && (
                      <p className="mt-2 text-xs text-gray-600 bg-white/60 rounded p-2 italic border border-gray-100">
                        "{bid.proposalMessage}"
                      </p>
                    )}

                    {/* Status message note */}
                    <div className="mt-3 flex items-center justify-between border-t border-gray-200/60 pt-2.5">
                      <p className="text-xs font-medium">
                        {isAccepted && (
                          <span className="text-emerald-700 font-semibold">
                            🎉 Your bid was accepted! This project is now an active job.
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-red-600 font-semibold">
                            Your bid was rejected by the client.
                          </span>
                        )}
                        {isSubmitted && (
                          <span className="text-amber-700 font-semibold">
                            You have submitted a bid for this project. Waiting for client review.
                          </span>
                        )}
                      </p>

                      {isAccepted && (
                        <button
                          onClick={() => onNavigate('project-update', typeof bid.projectId === 'object' && bid.projectId ? bid.projectId._id : String(bid.projectId))}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Update Milestones
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* New Job Matches */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {t(locale, 'newJobMatches') || 'New Job Matches & Opportunities'}
            </h2>
            <span className="text-xs text-navy-600 font-medium">Real-time Feed</span>
          </div>

          {loading ? (
            <div className="flex min-h-[160px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : jobMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
              No new projects available currently. Check back shortly for new client requirements.
            </div>
          ) : (
            <div className="space-y-3">
              {jobMatches.map((job) => {
                const clientName = typeof job.clientId === 'object' && job.clientId ? (job.clientId as any).fullName : (job as any).clientName || '';
                return (
                  <div
                    key={job._id}
                    className="rounded-xl bg-gray-100 p-4 transition-shadow hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-navy-700">{job.title}</h3>
                          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-500">
                            {job.category}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-600 line-clamp-1">{job.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          {clientName ? (
                            <span className="font-medium text-navy-800">
                              Posted by: <span className="font-bold text-navy-900">{clientName}</span>
                            </span>
                          ) : null}
                          <span className="font-semibold text-navy-700">
                            ₹{(job.budget || 25000).toLocaleString('en-IN')}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {job.location || 'Coimbatore'}
                          </span>
                          <span>{job.timeline || '2-3 weeks'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
                      <span className="text-xs text-gray-400">
                        {job.bidsCount || 0} {job.bidsCount === 1 ? 'bid received' : 'bids received'}
                      </span>
                      <button
                        onClick={() => onNavigate('submit-quote', job._id)}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-amber-300 shadow-soft"
                      >
                        {t(locale, 'submitQuoteBtn') || 'Submit Quotation'} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick update current active work */}
        <div className="mt-8 rounded-xl border border-navy-100 bg-navy-50 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-navy-800">Working on an Active Project?</h3>
            <p className="text-xs text-navy-600 mt-0.5">Post milestone updates, progress photos, and notify clients.</p>
          </div>
          <button
            onClick={() => onNavigate('project-update')}
            className="rounded-lg bg-navy-700 px-4 py-2 text-xs font-bold text-white hover:bg-navy-800"
          >
            Update Milestones
          </button>
        </div>

        {/* Payment QR card */}
        <div className="mt-8 rounded-xl border border-gray-100 bg-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy-700">Payment QR</h3>
              <p className="mt-0.5 text-xs text-gray-500">Customers scan to pay you directly via UPI</p>
            </div>
            <button
              onClick={() => alert('UPI QR replacement simulated.')}
              className="flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-navy-700"
            >
              <Upload className="h-3.5 w-3.5" /> Replace QR
            </button>
          </div>
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg bg-white p-6">
            <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
              <QrCode className="h-16 w-16 text-gray-300" />
            </div>
            <p className="mt-2 text-xs text-gray-400">Tap replace to upload your UPI QR</p>
          </div>
        </div>
      </div>
      <MicButton />
    </div>
  );
}
