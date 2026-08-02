import { Plus, MapPin, ChevronRight, ArrowLeft } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton, StatusBadge, StarRating, Avatar } from '../components/ui';
import { contractors, projects } from '../data';
import type { ScreenId } from '../types';

export function ClientHome({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  return (
    <div className="min-h-screen bg-white">
      <TopNav onNavigate={onNavigate} />
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-bold text-navy-700">Good morning, Arjun</h1>
        <p className="mt-1 text-sm text-gray-500">You have 2 active projects and 3 new contractor matches.</p>

        {/* Primary CTA */}
        <button
          onClick={() => onNavigate('post-project')}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-sm font-semibold text-navy-700 shadow-soft transition-all hover:bg-amber-300 hover:shadow-card">
          <Plus className="h-5 w-5" strokeWidth={2} />
          Post a Project
        </button>

        {/* Active Projects */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Active Projects</h2>
            <button className="text-sm font-medium text-navy-500 hover:text-navy-700">View all</button>
          </div>
          <div className="space-y-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onNavigate('project-tracking')}
                className="flex w-full items-center gap-4 rounded-xl bg-gray-100 p-4 text-left transition-shadow hover:shadow-soft"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-navy-700">{p.title}</h3>
                    <StatusBadge
                      status={p.status === 'Completed' ? 'completed' : p.status === 'In Progress' ? 'progress' : 'planning'}
                      label={p.status}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{p.category}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full ${p.progress === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600">{p.progress}%</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Recommended Contractors */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recommended Contractors</h2>
            <button
              onClick={() => onNavigate('contractor-results')}
              className="text-sm font-medium text-navy-500 hover:text-navy-700"
            >
              See all
            </button>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide md:mx-0 md:px-0">
            {contractors.slice(0, 4).map((c) => (
              <div
                key={c.id}
                className="w-44 shrink-0 rounded-xl bg-gray-100 p-4 transition-shadow hover:shadow-soft"
              >
                <Avatar src={c.photo} alt={c.name} size="lg" />
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-sm font-semibold text-navy-700">{c.name}</span>
                  {c.verified && (
                    <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-500">{c.specialization}</p>
                <div className="mt-1.5 flex items-center gap-1">
                  <StarRating rating={c.rating} />
                  <span className="text-xs text-gray-500">({c.reviews})</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3" /> {c.distance}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <MicButton />
    </div>
  );
}
