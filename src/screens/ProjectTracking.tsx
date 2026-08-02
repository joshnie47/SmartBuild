import { useState } from 'react';
import { Check, ChevronDown, MessageSquare, Clock } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton } from '../components/ui';
import { milestones } from '../data';
import type { ScreenId, Milestone } from '../types';

export function ProjectTracking({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [expanded, setExpanded] = useState<string | null>('m4');

  const completed = milestones.filter((m) => m.status === 'completed').length;
  const progress = Math.round((completed / milestones.length) * 100);

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-bold text-navy-700">Kitchen Pipe Repair</h1>

        {/* Progress bar */}
        <div className="mt-4 rounded-xl bg-navy-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-navy-100">Project Progress</p>
              <p className="text-2xl font-bold">{progress}% Complete</p>
            </div>
            <div className="text-right">
              <p className="flex items-center gap-1 text-sm text-navy-100">
                <Clock className="h-4 w-4" /> ETA
              </p>
              <p className="text-lg font-semibold">15 Aug 2026</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-800">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Stepper */}
        <div className="mt-6">
          {milestones.map((m, i) => {
            const isLast = i === milestones.length - 1;
            const isOpen = expanded === m.id;
            return (
              <div key={m.id} className="flex gap-4">
                {/* Line + dot */}
                <div className="flex flex-col items-center">
                  <MilestoneDot milestone={m} />
                  {!isLast && (
                    <div className={`w-0.5 flex-1 ${m.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'}`} style={{ minHeight: '32px' }} />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${
                        m.status === 'completed' ? 'text-navy-700' : m.status === 'current' ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        {m.label}
                      </span>
                      {m.status === 'current' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">In Progress</span>
                      )}
                    </div>
                    {m.status !== 'upcoming' && (
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>

                  {isOpen && m.status !== 'upcoming' && (
                    <div className="mt-3 animate-fadeIn rounded-lg bg-gray-100 p-3">
                      {m.timestamp && (
                        <p className="mb-1 flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" /> {m.timestamp}
                        </p>
                      )}
                      {m.note && <p className="text-sm text-navy-600">{m.note}</p>}
                      {m.photo && (
                        <img src={m.photo} alt={m.label} className="mt-2 h-32 w-full rounded-lg object-cover" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chat button */}
        <button
          onClick={() => onNavigate('chat')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-navy-200 py-3 text-sm font-semibold text-navy-600 transition-colors hover:bg-navy-50"
        >
          <MessageSquare className="h-4 w-4" /> Chat with Contractor
        </button>
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
        <span className="absolute inset-0 animate-pulseAmber rounded-full" />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400">
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
