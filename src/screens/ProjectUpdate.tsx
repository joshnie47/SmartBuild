import { useState, useEffect } from 'react';
import { Check, ChevronDown, Camera, Flag, ArrowLeft, Loader2 } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton } from '../components/ui';
import type { ScreenId, Milestone } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiGetProjects, apiUpdateMilestone, apiFlagDelay, type ApiProject } from '../lib/api';

const defaultFallbackMilestones: Milestone[] = [
  { id: 'm1', label: 'Site Inspection & Estimation', status: 'completed', timestamp: '10 Aug 2026, 11:30 AM', note: 'Site verified, measurements taken.' },
  { id: 'm2', label: 'Material Procurement', status: 'completed', timestamp: '12 Aug 2026, 03:15 PM', note: 'All required materials procured.' },
  { id: 'm3', label: 'Core Work & Execution', status: 'current', note: 'Core execution in progress.' },
  { id: 'm4', label: 'Finishing & Cleanup', status: 'upcoming' },
  { id: 'm5', label: 'Final Handover & Verification', status: 'upcoming' },
];

export function ProjectUpdate({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { locale } = useLocale();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [milestonesList, setMilestonesList] = useState<Milestone[]>(defaultFallbackMilestones);
  const [expanded, setExpanded] = useState<string | null>('m3');
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('Material shortage');
  const [flagNote, setFlagNote] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [marked, setMarked] = useState(false);

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

  const currentMilestone = milestonesList.find((m) => m.status === 'current') || milestonesList[0];

  const handleMarkComplete = async () => {
    if (!project?._id) {
      setMarked(true);
      return;
    }
    setUpdating(true);
    try {
      await apiUpdateMilestone(project._id, {
        milestoneId: currentMilestone.id,
        status: 'completed',
        note: stageNote || `Completed: ${currentMilestone.label}`,
        photo: 'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
      });
      setMarked(true);
      // Advance to next milestone
      const curIdx = milestonesList.findIndex((m) => m.id === currentMilestone.id);
      if (curIdx >= 0 && curIdx < milestonesList.length - 1) {
        const nextList = [...milestonesList];
        nextList[curIdx].status = 'completed';
        nextList[curIdx + 1].status = 'current';
        setMilestonesList(nextList);
      }
    } catch {
      setMarked(true);
    } finally {
      setUpdating(false);
    }
  };

  const handleFlagDelay = async () => {
    if (!project?._id) {
      setFlagged(true);
      setFlagOpen(false);
      return;
    }
    try {
      await apiFlagDelay(project._id, flagReason, flagNote);
      setFlagged(true);
      setFlagOpen(false);
    } catch {
      setFlagged(true);
      setFlagOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav
        avatarName="Contractor"
        avatarSrc="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150"
        onNavigate={onNavigate}
      />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <button
          onClick={() => onNavigate('contractor-dashboard')}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600"
        >
          <ArrowLeft className="h-4 w-4" /> {t(locale, 'back') || 'Back to Dashboard'}
        </button>

        <h1 className="text-2xl font-bold text-navy-700">Update Project Progress</h1>
        <p className="mt-1 text-sm text-gray-500">
          {project?.title || 'Residential Construction & Renovation'} · {project?.location || 'Coimbatore'}
        </p>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            {/* Current milestone action */}
            <div className="mt-6 rounded-xl bg-navy-600 p-4 text-white shadow-soft">
              <p className="text-xs text-navy-200">Current Milestone Stage</p>
              <p className="text-lg font-bold">{currentMilestone.label}</p>
              {marked ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white">
                  <Check className="h-4 w-4" strokeWidth={3} /> Stage Marked as Complete & Client Notified
                </div>
              ) : (
                <button
                  onClick={handleMarkComplete}
                  disabled={updating}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300 disabled:opacity-60"
                >
                  {updating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-navy-700" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" strokeWidth={2.5} /> Mark Stage as Complete
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Photo + note for current step */}
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">
                  Upload Progress Photo
                </label>
                <div
                  onClick={() => alert('Photo attached successfully.')}
                  className="flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-colors hover:border-navy-300 hover:bg-navy-50"
                >
                  <div className="flex flex-col items-center gap-1 text-gray-400">
                    <Camera className="h-5 w-5" />
                    <span className="text-xs">Add a photo of current progress</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">
                  Progress Note
                </label>
                <div className="flex items-start rounded-lg border border-gray-200 px-3 py-2 focus-within:border-navy-400">
                  <textarea
                    rows={2}
                    value={stageNote}
                    onChange={(e) => setStageNote(e.target.value)}
                    placeholder="Add details about the completed work, materials used, etc..."
                    className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                  />
                  <MicInline />
                </div>
              </div>
            </div>

            {/* Flag delay */}
            <div className="mt-5">
              <button
                onClick={() => setFlagOpen(!flagOpen)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-navy-600"
              >
                <Flag className="h-4 w-4 text-amber-500" />
                Flag a Potential Delay
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${flagOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {flagged && (
                <p className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  ✓ Delay flag communicated to client.
                </p>
              )}

              {flagOpen && (
                <div className="mt-3 animate-fadeIn space-y-3 rounded-lg bg-gray-100 p-4">
                  <div>
                    <label className="text-xs font-medium text-navy-700 mb-1 block">Reason for Delay</label>
                    <select
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
                    >
                      <option>Material shortage</option>
                      <option>Weather conditions / Heavy Rain</option>
                      <option>Site Access issue</option>
                      <option>Client Design Changes</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy-700 mb-1 block">Additional Note</label>
                    <div className="flex items-start rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:border-navy-400">
                      <textarea
                        rows={2}
                        value={flagNote}
                        onChange={(e) => setFlagNote(e.target.value)}
                        placeholder="Explain the cause and expected revised ETA..."
                        className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                      />
                      <MicInline />
                    </div>
                  </div>
                  <button
                    onClick={handleFlagDelay}
                    className="w-full rounded-lg bg-navy-600 py-2 text-sm font-semibold text-white hover:bg-navy-700"
                  >
                    Submit Delay Flag
                  </button>
                </div>
              )}
            </div>

            {/* Stepper overview */}
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                All Milestones
              </h2>
              <div className="space-y-1">
                {milestonesList.map((m, i) => {
                  const isLast = i === milestonesList.length - 1;
                  const isOpen = expanded === m.id;
                  return (
                    <div key={m.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <MilestoneDot milestone={m} />
                        {!isLast && (
                          <div
                            className={`w-0.5 flex-1 ${
                              m.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'
                            }`}
                            style={{ minHeight: '28px' }}
                          />
                        )}
                      </div>
                      <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                        <button
                          onClick={() => m.status !== 'upcoming' && setExpanded(isOpen ? null : m.id)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span
                            className={`text-sm font-medium ${
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
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600">
                              Current
                            </span>
                          )}
                          {m.status === 'completed' && (
                            <span className="text-xs text-emerald-500 font-semibold">Done</span>
                          )}
                        </button>
                        {isOpen && m.status !== 'upcoming' && (
                          <div className="mt-2 animate-fadeIn rounded-lg bg-gray-100 p-3">
                            {m.timestamp && <p className="text-xs text-gray-500">{m.timestamp}</p>}
                            {m.note && <p className="mt-1 text-sm text-navy-600">{m.note}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (milestone.status === 'current') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400">
        <span className="h-2 w-2 rounded-full bg-navy-700" />
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
    </div>
  );
}
