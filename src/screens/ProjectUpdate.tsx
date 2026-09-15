import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Camera, Flag, ArrowLeft, Loader2, AlertTriangle, ShieldCheck, RefreshCw, X, Sparkles } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton } from '../components/ui';
import type { ScreenId, Milestone, ProjectEvidenceItem } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import {
  apiGetProjects,
  apiGetProjectById,
  apiGetContractorMyProjects,
  apiUpdateMilestone,
  apiFlagDelay,
  apiValidateProjectEvidence,
  type ApiProject,
  type ApiEvidenceValidationResult,
  type ApiEvidenceItem,
} from '../lib/api';

const defaultFallbackMilestones: Milestone[] = [
  { id: 'm1', label: 'Site Visit & Initial Setup', status: 'current', note: 'Site visit & layout setup in progress.' },
  { id: 'm2', label: 'Material Procurement', status: 'upcoming' },
  { id: 'm3', label: 'Core Work & Execution', status: 'upcoming' },
  { id: 'm4', label: 'Finishing & Inspection', status: 'upcoming' },
  { id: 'm5', label: 'Final Handover', status: 'upcoming' },
];

export interface EvidenceQueueItem {
  id: string;
  file?: File;
  previewUrl: string;
  originalFilename: string;
  status: 'validating' | 'verified' | 'ai_detected' | 'error';
  validationResult?: ApiEvidenceValidationResult;
  errorMessage?: string;
}

export function ProjectUpdate({ onNavigate, projectId }: { onNavigate: (id: ScreenId, projectId?: string) => void; projectId?: string }) {
  const { locale } = useLocale();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [milestonesList, setMilestonesList] = useState<Milestone[]>(defaultFallbackMilestones);
  const [expanded, setExpanded] = useState<string | null>('m1');
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('Material shortage');
  const [flagNote, setFlagNote] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [marked, setMarked] = useState(false);

  const [evidenceQueue, setEvidenceQueue] = useState<EvidenceQueueItem[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        let targetProject: ApiProject | null = null;

        if (projectId) {
          try {
            const res = await apiGetProjectById(projectId);
            if (res && res.project) targetProject = res.project;
          } catch {
            // Fallback
          }
        }

        if (!targetProject) {
          try {
            const awarded = await apiGetContractorMyProjects();
            if (awarded.length > 0) targetProject = awarded[0];
          } catch {
            const projects = await apiGetProjects();
            if (projects.length > 0) targetProject = projects[0];
          }
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

  const currentMilestone = milestonesList.find((m) => m.status === 'current') || milestonesList[0];

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !project?._id) return;

    const newItems: EvidenceQueueItem[] = files.map((file) => ({
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      originalFilename: file.name,
      status: 'validating',
    }));

    setEvidenceQueue((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      if (!item.file) continue;
      try {
        const res = await apiValidateProjectEvidence(project._id, [item.file]);
        const result = res.results?.[0];

        if (!result) {
          setEvidenceQueue((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'error', errorMessage: 'Unable to verify photo. Please try again.' }
                : it
            )
          );
          continue;
        }

        if (result.isAiGenerated) {
          setEvidenceQueue((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: 'ai_detected',
                    validationResult: result,
                    errorMessage: result.message || 'AI-generated or manipulated image detected. Please upload a genuine site photo.',
                  }
                : it
            )
          );
        } else {
          setEvidenceQueue((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: 'verified',
                    validationResult: result,
                  }
                : it
            )
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to verify this photo right now. Please try again.';
        setEvidenceQueue((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'error', errorMessage: msg } : it))
        );
      }
    }

    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleRemoveEvidence = (id: string) => {
    setEvidenceQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRetryValidation = async (id: string) => {
    const item = evidenceQueue.find((it) => it.id === id);
    if (!item || !item.file || !project?._id) return;

    setEvidenceQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: 'validating', errorMessage: undefined } : it))
    );

    try {
      const res = await apiValidateProjectEvidence(project._id, [item.file]);
      const result = res.results?.[0];

      if (!result) {
        setEvidenceQueue((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, status: 'error', errorMessage: 'Unable to verify photo. Please try again.' }
              : it
          )
        );
        return;
      }

      if (result.isAiGenerated) {
        setEvidenceQueue((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: 'ai_detected',
                  validationResult: result,
                  errorMessage: result.message || 'AI-generated or manipulated image detected. Please upload a genuine site photo.',
                }
              : it
          )
        );
      } else {
        setEvidenceQueue((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: 'verified',
                  validationResult: result,
                }
              : it
          )
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to verify this photo right now. Please try again.';
      setEvidenceQueue((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: 'error', errorMessage: msg } : it))
      );
    }
  };

  const isValidating = evidenceQueue.some((i) => i.status === 'validating');
  const hasAiRejected = evidenceQueue.some((i) => i.status === 'ai_detected');

  const handleMarkComplete = async () => {
    if (!currentMilestone || isValidating || hasAiRejected) return;
    setUpdating(true);
    try {
      const verifiedEvidenceItems: ApiEvidenceItem[] = evidenceQueue
        .filter((i) => i.status === 'verified' && i.validationResult?.evidenceItem)
        .map((i) => i.validationResult!.evidenceItem!);
      const verifiedPhotos = verifiedEvidenceItems.map((e) => e.photoUrl);

      if (project?._id) {
        const payload: {
          milestoneId: string;
          status: string;
          note?: string;
          photo?: string;
          photos?: string[];
          evidenceItems?: ApiEvidenceItem[];
        } = {
          milestoneId: currentMilestone.id,
          status: 'completed',
        };
        if (stageNote.trim()) payload.note = stageNote.trim();
        if (verifiedPhotos.length > 0) {
          payload.photo = verifiedPhotos[0];
          payload.photos = verifiedPhotos;
        }
        if (verifiedEvidenceItems.length > 0) {
          payload.evidenceItems = verifiedEvidenceItems;
        }

        const res = await apiUpdateMilestone(project._id, payload);
        const updatedProject = (res as any).project;
        if (updatedProject && updatedProject.milestones) {
          setProject(updatedProject);
          const mapped: Milestone[] = updatedProject.milestones.map((m: any) => ({
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
          const nextCur = mapped.find((x) => x.status === 'current');
          if (nextCur) setExpanded(nextCur.id);
        }
      } else {
        const curIdx = milestonesList.findIndex((m) => m.id === currentMilestone.id);
        if (curIdx >= 0 && curIdx < milestonesList.length - 1) {
          const nextList = [...milestonesList];
          nextList[curIdx].status = 'completed';
          nextList[curIdx].photo = verifiedPhotos[0];
          nextList[curIdx].photos = verifiedPhotos;
          nextList[curIdx].evidenceItems = verifiedEvidenceItems as any;
          nextList[curIdx + 1].status = 'current';
          setMilestonesList(nextList);
        }
      }
      setMarked(true);
      setStageNote('');
      setEvidenceQueue([]);
    } catch (err) {
      console.error('Error marking milestone complete:', err);
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
                  disabled={updating || isValidating || hasAiRejected}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {updating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-navy-700" />
                  ) : isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-navy-700" /> Verifying Evidence Photos...
                    </>
                  ) : hasAiRejected ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-900" /> Remove Suspicious Photos to Proceed
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" strokeWidth={2.5} /> Mark Stage as Complete
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Hidden Photo Input */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {/* Photo + note for current step */}
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">
                  Upload Proof / Evidence Photos <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                </label>

                {/* Dropzone Button */}
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-colors hover:border-navy-300 hover:bg-navy-50"
                >
                  <div className="flex flex-col items-center gap-1 text-gray-400">
                    <Camera className="h-5 w-5 text-amber-500" />
                    <span className="text-xs font-medium text-navy-700">Add genuine site photos of current progress</span>
                    <span className="text-[11px] text-gray-400">Photos will be verified by SmartBuild AI Forensics Engine</span>
                  </div>
                </div>

                {/* Evidence Queue Items */}
                {evidenceQueue.length > 0 && (
                  <div className="mt-3 space-y-2.5">
                    {evidenceQueue.map((item) => {
                      const isAi = item.status === 'ai_detected';
                      const isVerified = item.status === 'verified';
                      const isValidatingItem = item.status === 'validating';
                      const isErr = item.status === 'error';

                      const confidencePct = item.validationResult
                        ? Math.round((item.validationResult.authenticityScore ?? (1 - item.validationResult.aiConfidence)) * 100)
                        : null;

                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border ${
                            isAi
                              ? 'bg-amber-50/90 border-amber-300'
                              : isVerified
                              ? 'bg-emerald-50/90 border-emerald-300'
                              : isErr
                              ? 'bg-red-50/90 border-red-300'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <img
                              src={item.previewUrl}
                              alt="Site Evidence"
                              className="h-14 w-14 rounded-lg object-cover border border-gray-200 shrink-0"
                            />
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-xs font-semibold text-navy-800 truncate max-w-[200px]">
                                {item.originalFilename}
                              </p>

                              {isValidatingItem && (
                                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Verifying photo with AI forensic engine...</span>
                                </div>
                              )}

                              {isVerified && (
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    <span>✓ Photo Verified ({confidencePct}% Real)</span>
                                  </div>
                                  <p className="text-[11px] text-emerald-800">
                                    {item.validationResult?.analysisReason || 'Genuine site camera signatures verified.'}
                                  </p>
                                </div>
                              )}

                              {isAi && (
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs text-amber-900 font-bold">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <span>⚠️ AI-generated or manipulated image detected</span>
                                  </div>
                                  <p className="text-[11px] text-amber-800 font-medium leading-tight">
                                    This photo cannot be used as project proof. Please upload a genuine site photo.
                                  </p>
                                  {item.validationResult?.analysisReason && (
                                    <p className="text-[10px] text-amber-700 italic">
                                      Evidence: {item.validationResult.analysisReason}
                                    </p>
                                  )}
                                </div>
                              )}

                              {isErr && (
                                <div className="flex flex-col space-y-0.5">
                                  <p className="text-xs text-red-700 font-semibold">
                                    Unable to verify this photo. Please try again.
                                  </p>
                                  {item.errorMessage && (
                                    <p className="text-[10px] text-red-600">{item.errorMessage}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {isAi && (
                              <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                className="flex items-center gap-1 text-xs font-semibold bg-amber-600 text-white px-2.5 py-1 rounded-md hover:bg-amber-700 transition-colors shadow-xs"
                              >
                                <RefreshCw className="h-3 w-3" /> Upload Another Photo
                              </button>
                            )}

                            {isErr && (
                              <button
                                type="button"
                                onClick={() => handleRetryValidation(item.id)}
                                className="flex items-center gap-1 text-xs font-semibold bg-navy-600 text-white px-2 py-1 rounded-md hover:bg-navy-700 transition-colors"
                              >
                                <RefreshCw className="h-3 w-3" /> Retry
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveEvidence(item.id)}
                              className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-gray-200 transition-colors"
                              title="Remove photo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
