import { useState } from 'react';
import { Check, ChevronDown, Camera, Flag } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton } from '../components/ui';
import { milestones } from '../data';
import type { ScreenId, Milestone } from '../types';

export function ProjectUpdate({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [expanded, setExpanded] = useState<string | null>('m4');
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [marked, setMarked] = useState(false);

  const currentMilestone = milestones.find((m) => m.status === 'current')!;

  return (
    <div className="min-h-screen bg-white">
      <TopNav avatarName="Rajesh Kumar" avatarSrc="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150" />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-bold text-navy-700">Update Project</h1>
        <p className="mt-1 text-sm text-gray-500">Kitchen Pipe Repair · for Arjun Mehta</p>

        {/* Current milestone action */}
        <div className="mt-6 rounded-xl bg-navy-600 p-4">
          <p className="text-sm text-navy-100">Current Stage</p>
          <p className="text-lg font-semibold text-white">{currentMilestone.label}</p>
          {marked ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white">
              <Check className="h-4 w-4" strokeWidth={3} /> Stage Marked as Complete
            </div>
          ) : (
            <button
              onClick={() => setMarked(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} /> Mark Stage as Complete
            </button>
          )}
        </div>

        {/* Photo + note for current step */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">Upload Progress Photo</label>
            <div className="flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-colors hover:border-navy-300 hover:bg-navy-50">
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <Camera className="h-5 w-5" />
                <span className="text-xs">Add a photo of current progress</span>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">Note</label>
            <div className="flex items-start rounded-lg border border-gray-200 px-3 py-2 focus-within:border-navy-400">
              <textarea
                rows={2}
                placeholder="Add a note about the current work..."
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
            <Flag className="h-4 w-4" />
            Flag a Delay
            <ChevronDown className={`h-4 w-4 transition-transform ${flagOpen ? 'rotate-180' : ''}`} />
          </button>
          {flagOpen && (
            <div className="mt-3 animate-fadeIn space-y-3 rounded-lg bg-gray-100 p-4">
              <select
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
              >
                <option value="">Select reason...</option>
                <option>Material shortage</option>
                <option>Weather conditions</option>
                <option>Access issue</option>
                <option>Other</option>
              </select>
              <div className="flex items-start rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:border-navy-400">
                <textarea
                  rows={2}
                  placeholder="Optional note..."
                  className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
                <MicInline />
              </div>
              <button className="w-full rounded-lg border border-navy-600 py-2 text-sm font-semibold text-navy-600 hover:bg-navy-50">
                Submit Flag
              </button>
            </div>
          )}
        </div>

        {/* Stepper overview */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">All Milestones</h2>
          <div className="space-y-1">
            {milestones.map((m, i) => {
              const isLast = i === milestones.length - 1;
              const isOpen = expanded === m.id;
              return (
                <div key={m.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <MilestoneDot milestone={m} />
                    {!isLast && <div className={`w-0.5 flex-1 ${m.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'}`} style={{ minHeight: '24px' }} />}
                  </div>
                  <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                    <button
                      onClick={() => m.status !== 'upcoming' && setExpanded(isOpen ? null : m.id)}
                      className="flex w-full items-center justify-between"
                    >
                      <span className={`text-sm font-medium ${
                        m.status === 'completed' ? 'text-navy-700' : m.status === 'current' ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        {m.label}
                      </span>
                      {m.status === 'current' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600">Current</span>}
                      {m.status === 'completed' && <span className="text-xs text-emerald-500">Done</span>}
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
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-pulseAmber rounded-full" />
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400">
          <span className="h-2 w-2 rounded-full bg-navy-700" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
    </div>
  );
}
