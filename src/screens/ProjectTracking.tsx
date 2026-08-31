import { useState, useEffect } from 'react';
import { Check, ChevronDown, MessageSquare, Clock, ArrowLeft, Star, AlertCircle, Loader2 } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton } from '../components/ui';
import type { ScreenId, Milestone } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiGetProjects, type ApiProject } from '../lib/api';

const defaultFallbackMilestones: Milestone[] = [
  { id: 'm1', label: 'Site Inspection & Estimation', status: 'completed', timestamp: '10 Aug 2026, 11:30 AM', note: 'Site verified, measurements taken.' },
  { id: 'm2', label: 'Material Procurement', status: 'completed', timestamp: '12 Aug 2026, 03:15 PM', note: 'All required pipes, fittings, and cement procured.' },
  { id: 'm3', label: 'Core Work & Pipe Replacement', status: 'completed', timestamp: '14 Aug 2026, 05:40 PM', note: 'Main line joint replaced, pressure testing passed.' },
  { id: 'm4', label: 'Finishing & Cleanup', status: 'current', note: 'Tile reinstatement and cleanup in progress.' },
  { id: 'm5', label: 'Final Handover & Verification', status: 'upcoming' },
];

export function ProjectTracking({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { locale } = useLocale();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [milestonesList, setMilestonesList] = useState<Milestone[]>(defaultFallbackMilestones);
  const [expanded, setExpanded] = useState<string | null>('m4');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        const projects = await apiGetProjects();
        if (projects.length > 0) {
          const p = projects[0];
          setProject(p);
          if (p.milestones && p.milestones.length > 0) {
            const mapped: Milestone[] = p.milestones.map((m) => ({
              id: m.id,
              label: m.label,
              status: m.status,
              timestamp: m.timestamp,
              note: m.note,
              photo: m.photo,
            }));
            setMilestonesList(mapped);
            const cur = mapped.find((x) => x.status === 'current');
            if (cur) setExpanded(cur.id);
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, []);

  const completed = milestonesList.filter((m) => m.status === 'completed').length;
  const progress = Math.round((completed / milestonesList.length) * 100);
  const isAllComplete = completed === milestonesList.length;

  return (
    <div className="min-h-screen bg-white">
      <TopNav onNavigate={onNavigate} />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <button
          onClick={() => onNavigate('client-home')}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600"
        >
          <ArrowLeft className="h-4 w-4" /> {t(locale, 'back') || 'Back to Projects'}
        </button>

        <h1 className="text-2xl font-bold text-navy-700">
          {project?.title || 'Residential Construction & Renovation'}
        </h1>
        <p className="mt-0.5 text-xs text-gray-500">
          {project?.location || 'Coimbatore'} · Category: {project?.category || 'Construction'}
        </p>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            {/* Progress bar card */}
            <div className="mt-4 rounded-xl bg-navy-600 p-4 text-white shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-navy-200">
                    {t(locale, 'projectProgress') || 'Project Progress'}
                  </p>
                  <p className="text-2xl font-bold">{progress}% Complete</p>
                </div>
                <div className="text-right">
                  <p className="flex items-center gap-1 text-xs text-navy-200 justify-end">
                    <Clock className="h-3.5 w-3.5" /> ETA
                  </p>
                  <p className="text-base font-semibold">{project?.timeline || '15 Aug 2026'}</p>
                </div>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-navy-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Delay Flag Banner if present */}
            {project?.delayFlag?.flagged && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Contractor Note:</strong> Potential delay flagged: {project.delayFlag.reason}. {project.delayFlag.note}
                </span>
              </div>
            )}

            {/* Milestone Stepper */}
            <div className="mt-6">
              {milestonesList.map((m, i) => {
                const isLast = i === milestonesList.length - 1;
                const isOpen = expanded === m.id;
                return (
                  <div key={m.id} className="flex gap-4">
                    {/* Line + dot */}
                    <div className="flex flex-col items-center">
                      <MilestoneDot milestone={m} />
                      {!isLast && (
                        <div
                          className={`w-0.5 flex-1 ${
                            m.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'
                          }`}
                          style={{ minHeight: '36px' }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : m.id)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              m.status === 'completed'
                                ? 'text-navy-700'
                                : m.status === 'current'
                                ? 'text-amber-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {m.label}
                          </span>
                          {m.status === 'current' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              In Progress
                            </span>
                          )}
                        </div>
                        {m.status !== 'upcoming' && (
                          <ChevronDown
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </button>

                      {isOpen && m.status !== 'upcoming' && (
                        <div className="mt-2 animate-fadeIn rounded-lg bg-gray-100 p-3">
                          {m.timestamp && (
                            <p className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" /> {m.timestamp}
                            </p>
                          )}
                          {m.note && <p className="text-xs text-navy-700">{m.note}</p>}
                          {m.photo && (
                            <img
                              src={m.photo}
                              alt={m.label}
                              className="mt-2 h-32 w-full rounded-lg object-cover"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="mt-6 space-y-2">
              {isAllComplete ? (
                <button
                  onClick={() => onNavigate('review-dispute')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700"
                >
                  <Star className="h-4 w-4 fill-current" /> Rate & Review Project
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('review-dispute')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-xs font-semibold text-navy-700 hover:bg-amber-300"
                >
                  Project Completed? Leave Review / Dispute
                </button>
              )}

              <button
                onClick={() => onNavigate('chat')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-navy-200 py-2.5 text-xs font-semibold text-navy-600 hover:bg-navy-50"
              >
                <MessageSquare className="h-4 w-4" /> {t(locale, 'chatWithContractor') || 'Chat with Contractor'}
              </button>
            </div>
          </>
        )}
      </div>
      <MicButton />
    </div>
  );
}

function MilestoneDot({ milestone }: { milestone: Milestone }) {
  if (milestone.status === 'completed') {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
        <Check className="h-4 w-4 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (milestone.status === 'current') {
    return (
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 ring-4 ring-amber-100">
          <span className="h-2.5 w-2.5 rounded-full bg-navy-700" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white">
      <span className="h-2 w-2 rounded-full bg-gray-300" />
    </div>
  );
}
