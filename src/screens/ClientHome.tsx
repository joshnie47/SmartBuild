import { useState, useEffect } from 'react';
import { Plus, MapPin, ChevronRight, FileText, BadgeCheck } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton, StatusBadge, StarRating, Avatar } from '../components/ui';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import {
  apiGetMe,
  apiGetContractors,
  apiGetMyProjects,
  type ApiContractor,
  type ApiProject,
} from '../lib/api';

type BadgeStatus =
  | 'completed'
  | 'current'
  | 'upcoming'
  | 'planning'
  | 'progress'
  | 'review';

export function ClientHome({
  onNavigate,
}: {
  onNavigate: (id: ScreenId, projectId?: string) => void;
}) {
  const { locale } = useLocale();
  const [clientName, setClientName] = useState('');
  const [contractors, setContractors] = useState<ApiContractor[]>([]);
  const [contractorsLoading, setContractorsLoading] = useState(true);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  useEffect(() => {
    apiGetMe()
      .then((user) => setClientName(user.fullName.split(' ')[0]))
      .catch(() => {});

    apiGetContractors()
      .then(setContractors)
      .catch(() => {})
      .finally(() => setContractorsLoading(false));

    apiGetMyProjects()
      .then(setProjects)
      .catch(() => setProjectsError('Could not load projects.'))
      .finally(() => setProjectsLoading(false));
  }, []);

  function projectBadge(status: string): {
    badgeStatus: BadgeStatus;
    label: string;
  } {
    switch (status) {
      case 'IN_PROGRESS':
        return { badgeStatus: 'progress', label: t(locale, 'statusInProgress') };
      case 'PENDING_VERIFICATION':
        return {
          badgeStatus: 'current',
          label: t(locale, 'statusPendingVerification'),
        };
      case 'COMPLETED':
        return {
          badgeStatus: 'completed',
          label: t(locale, 'statusCompleted'),
        };
      case 'CANCELLED':
        return {
          badgeStatus: 'upcoming',
          label: t(locale, 'statusCancelled'),
        };
      default:
        return { badgeStatus: 'planning', label: t(locale, 'statusOpen') };
    }
  }

  const handleProjectClick = (p: ApiProject) => {
    if (p.status === 'OPEN') {
      onNavigate('contractor-results', p._id);
    } else {
      onNavigate('project-tracking', p._id);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav onNavigate={onNavigate} />
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-bold text-navy-700">
          {t(locale, 'goodMorning')}, {clientName || '...'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t(locale, 'activeProjectsSummary')}
        </p>

        {/* Primary CTA */}
        <button
          onClick={() => onNavigate('post-project')}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-sm font-semibold text-navy-700 shadow-soft transition-all hover:bg-amber-300 hover:shadow-card"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
          {t(locale, 'postAProject')}
        </button>

        {/* Active Projects */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {t(locale, 'activeProjects')}
              {!projectsLoading && (
                <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-navy-700">
                  {projects.length}
                </span>
              )}
            </h2>
            <button
              onClick={() => onNavigate('post-project')}
              className="text-xs font-semibold text-navy-500 hover:text-navy-700"
            >
              + {t(locale, 'postAProject')}
            </button>
          </div>
          <div className="space-y-3">
            {projectsLoading ? (
              <p className="text-sm text-gray-400 py-4">{t(locale, 'loading')}</p>
            ) : projectsError ? (
              <p className="text-sm text-red-400 py-4">{projectsError}</p>
            ) : projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">
                  {t(locale, 'noActiveProjectsYet')}
                </p>
              </div>
            ) : (
              projects.map((p) => {
                const { badgeStatus, label } = projectBadge(p.status);
                return (
                  <button
                    key={p._id}
                    onClick={() => handleProjectClick(p)}
                    className="flex w-full items-center gap-4 rounded-xl bg-gray-50 border border-gray-100 p-4 text-left transition-shadow hover:shadow-soft"
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy-700">
                          {p.title}
                        </h3>
                        <StatusBadge status={badgeStatus} label={label} />
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          (p.bidsCount || 0) > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {(p.bidsCount || 0) === 1
                            ? t(locale, 'oneBidReceived') || '1 Bid Received'
                            : (p.bidsCount || 0) === 0
                            ? t(locale, 'zeroBidsReceived') || '0 Bids Received'
                            : t(locale, 'bidsReceivedCount').replace('{count}', String(p.bidsCount || 0))}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {p.category} · ₹{p.budget.toLocaleString('en-IN')} · {p.location}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        ⏱️ {p.timeline}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Recommended Contractors */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {t(locale, 'recommendedContractors')}
            </h2>
            <button
              onClick={() => onNavigate('contractor-results')}
              className="text-xs font-semibold text-navy-500 hover:text-navy-700"
            >
              {t(locale, 'seeAll')}
            </button>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide md:mx-0 md:px-0">
            {contractorsLoading ? (
              <p className="text-sm text-gray-400 py-4">{t(locale, 'loading')}</p>
            ) : contractors.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">
                No verified contractors available right now. Check back soon.
              </p>
            ) : (
              contractors.slice(0, 6).map((c) => (
                <div
                  key={c._id}
                  className="w-52 shrink-0 rounded-xl bg-gray-50 border border-gray-100 p-4 transition-shadow hover:shadow-soft"
                >
                  <Avatar src={c.profileImage} alt={c.fullName} size="lg" />
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-sm font-semibold text-navy-700 truncate">
                      {c.fullName}
                    </span>
                    {c.isVerified && (
                      <BadgeCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {c.specialization || 'General Works'}
                  </p>

                  {/* Portfolio Authenticity Pill */}
                  {c.portfolioAuthenticity && c.portfolioAuthenticity.status !== 'NO_PHOTOS' && (
                    <div className="mt-1.5">
                      {c.portfolioAuthenticity.status === 'ALL_REAL' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100/90 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                          🛡️ 100% Real Work Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-purple-100/90 px-1.5 py-0.5 text-[9px] font-bold text-purple-800">
                          ✨ Real + AI Concept
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center gap-1">
                    <StarRating rating={c.averageRating || 5} />
                    <span className="text-xs text-gray-500">
                      ({c.completedProjects || 0})
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="h-3 w-3 text-amber-500" />{' '}
                    {c.city || 'Tamil Nadu'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <MicButton />
    </div>
  );
}
