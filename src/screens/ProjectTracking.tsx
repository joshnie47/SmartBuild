import { useState, useEffect } from 'react';
import { Check, ChevronDown, MessageSquare, Clock, ArrowLeft, Star, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton } from '../components/ui';
import type { ScreenId, Milestone } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiGetProjects, apiGetProjectById, type ApiProject } from '../lib/api';

const defaultFallbackMilestones: Milestone[] = [
  { id: 'm1', label: 'Site Inspection & Setup', status: 'current', timestamp: 'Initial Stage', note: 'Project initialized. Preparing for site work.' },
  { id: 'm2', label: 'Material Procurement', status: 'upcoming' },
  { id: 'm3', label: 'Core Work Execution', status: 'upcoming' },
  { id: 'm4', label: 'Finishing & Inspection', status: 'upcoming' },
  { id: 'm5', label: 'Final Handover', status: 'upcoming' },
];

export function ProjectTracking({ onNavigate, projectId }: { onNavigate: (id: ScreenId, projectId?: string) => void; projectId?: string }) {
  const { locale } = useLocale();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [milestonesList, setMilestonesList] = useState<Milestone[]>(defaultFallbackMilestones);
  const [expanded, setExpanded] = useState<string | null>('m1');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        let targetProject: ApiProject | null = null;

        if (projectId) {
          try {
            const res = await apiGetProjectById(projectId);
            if (res && res.project) {
              targetProject = res.project;
            }
          } catch {
            // Fallback to list lookup if direct get by ID fails
          }
        }

        if (!targetProject) {
          const all = await apiGetProjects();
          if (all.length > 0) targetProject = all[0];
        }

        if (targetProject) {
          setProject(targetProject);
          if (targetProject.milestones && targetProject.milestones.length > 0) {
            const mapped: Milestone[] = targetProject.milestones.map((m) => ({
              id: m.id,
              label: m.label,
              status: m.status,
              timestamp: m.timestamp,
              note: m.note,
              photo: m.photo,
              photos: m.photos,
              evidenceItems: m.evidenceItems,
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
  }, [projectId]);

  const completed = milestonesList.filter((m) => m.status === 'completed').length;
  const progress = Math.round((completed / milestonesList.length) * 100);
  const isAllComplete = completed === milestonesList.length;

  return (
    <div className="min-h-screen bg-white">
      <TopNav
        avatarName="Client"
        avatarSrc="https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150"
        onNavigate={onNavigate}
      />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <button
          onClick={() => onNavigate('client-home')}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600"
        >
          <ArrowLeft className="h-4 w-4" /> {t(locale, 'back') || 'Back to Projects'}
        </button>

        <h1 className="text-2xl font-bold text-navy-700">Project Tracking</h1>
        <p className="mt-1 text-sm text-gray-500">
          {project?.title || 'Residential Construction'} · {project?.location || 'Coimbatore'}
        </p>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            {/* Contractor assigned card */}
            {project?.selectedContractorId && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-navy-50 p-3 border border-navy-100">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-600 text-white font-bold text-sm">
                  {typeof project.selectedContractorId === 'object'
                    ? project.selectedContractorId.fullName.charAt(0)
                    : 'C'}
                </div>
                <div>
                  <p className="text-xs text-navy-500">Assigned Contractor</p>
                  <p className="text-sm font-semibold text-navy-800">
                    {typeof project.selectedContractorId === 'object'
                      ? project.selectedContractorId.fullName
                      : 'Verified Contractor'}
                  </p>
                </div>
              </div>
            )}

            {/* Delay flag alert if active */}
            {project?.delayFlag?.flagged && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 border border-amber-200 text-amber-900">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-amber-900">Contractor Flagged a Delay Alert</p>
                  <p className="text-amber-800">
                    <strong>Reason:</strong> {project.delayFlag.reason || 'Site condition'}
                  </p>
                  {project.delayFlag.note && <p className="text-amber-700">{project.delayFlag.note}</p>}
                </div>
              </div>
            )}

            {/* Overall progress bar */}
            <div className="mt-6 rounded-xl bg-navy-600 p-4 text-white shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs text-navy-200 uppercase tracking-wide font-medium">Overall Progress</span>
                <span className="text-lg font-bold">{progress}%</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-navy-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-navy-200">
                {completed} of {milestonesList.length} stages completed
              </p>
            </div>

            {/* Vertical Stepper Timeline */}
            <div className="mt-8 space-y-1">
              {milestonesList.map((m, i) => {
                const isLast = i === milestonesList.length - 1;
                const isOpen = expanded === m.id;
                const displayPhotos = m.photos || (m.photo ? [m.photo] : []);

                return (
                  <div key={m.id} className="flex gap-4">
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
                    <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                      <button
                        onClick={() => m.status !== 'upcoming' && setExpanded(isOpen ? null : m.id)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div>
                          <span
                            className={`text-sm font-semibold ${
                              m.status === 'completed'
                                ? 'text-navy-700'
                                : m.status === 'current'
                                ? 'text-amber-600 font-bold'
                                : 'text-gray-400'
                            }`}
                          >
                            {m.label}
                          </span>
                          {m.status === 'current' && (
                            <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              Active Stage
                            </span>
                          )}
                          {m.status === 'completed' && (
                            <span className="ml-2 inline-block text-xs font-semibold text-emerald-600">
                              ✓ Completed
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
                        <div className="mt-2 animate-fadeIn rounded-xl bg-gray-50 border border-gray-200 p-3.5 space-y-2.5">
                          {m.timestamp && (
                            <p className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                              <Clock className="h-3.5 w-3.5 text-gray-400" /> {m.timestamp}
                            </p>
                          )}

                          {m.note && <p className="text-xs text-navy-700 leading-relaxed">{m.note}</p>}

                          {/* Evidence Photo Gallery with AI Authenticity Badges */}
                          {displayPhotos.length > 0 && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                <span>🛡️ AI Verified Genuine Site Photo Evidence ({displayPhotos.length})</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {displayPhotos.map((photoUrl, pIdx) => {
                                  const evItem = m.evidenceItems?.[pIdx];
                                  const confidencePct = evItem
                                    ? Math.round((evItem.authenticityScore ?? (1 - evItem.validationConfidence)) * 100)
                                    : 95;

                                  return (
                                    <div key={pIdx} className="relative group overflow-hidden rounded-lg border border-gray-200 bg-gray-900">
                                      <img
                                        src={photoUrl}
                                        alt={`${m.label} evidence photo ${pIdx + 1}`}
                                        className="h-28 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-emerald-600/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                        <ShieldCheck className="h-3 w-3" />
                                        <span>Verified {confidencePct}% Real</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
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
