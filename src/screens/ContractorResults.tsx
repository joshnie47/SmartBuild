import { useState } from 'react';
import { Check, MapPin, BadgeCheck, Eye, GitCompare, ArrowLeft, Trophy } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton, StarRating } from '../components/ui';
import { contractors } from '../data';
import type { ScreenId, Contractor } from '../types';

export function ContractorResults({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [view, setView] = useState<'list' | 'compare'>('list');
  const [compareIds, setCompareIds] = useState<string[]>(['c1', 'c2']);
  const [selected, setSelected] = useState<string | null>(null);

  const compareList = contractors.filter((c) => compareIds.includes(c.id));

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <button onClick={() => onNavigate('client-home')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy-700">Matched Contractors</h1>
            <p className="mt-1 text-sm text-gray-500">{contractors.length} contractors found for your plumbing project</p>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setView('list')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-white text-navy-700 shadow-soft' : 'text-gray-500'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('compare')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                view === 'compare' ? 'bg-white text-navy-700 shadow-soft' : 'text-gray-500'
              }`}
            >
              Compare
            </button>
          </div>
        </div>

        {view === 'list' ? (
          <div className="mt-6 space-y-3">
            {contractors.map((c) => (
              <div key={c.id} className="rounded-xl bg-gray-100 p-4 transition-shadow hover:shadow-soft">
                <div className="flex items-start gap-4">
                  <img src={c.photo} alt={c.name} className="h-14 w-14 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-navy-700">{c.name}</h3>
                      {c.verified && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-500">
                          <BadgeCheck className="h-4 w-4" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{c.specialization} · {c.experience} exp</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><StarRating rating={c.rating} /> {c.rating} ({c.reviews})</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.distance}</span>
                    </div>
                  </div>
                  {/* Match score */}
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-lg font-bold text-navy-700">{c.matchScore}%</span>
                    </div>
                    <p className="text-xs text-gray-400">match</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-xs text-gray-400">Quoted</span>
                      <p className="font-semibold text-navy-700">₹{c.quotedPrice.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Timeline</span>
                      <p className="font-semibold text-navy-700">{c.timeline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCompare(c.id)}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        compareIds.includes(c.id)
                          ? 'border-navy-600 bg-navy-600 text-white'
                          : 'border-gray-200 text-navy-600 hover:bg-navy-50'
                      }`}
                    >
                      {compareIds.includes(c.id) ? <Check className="h-3.5 w-3.5" /> : <GitCompare className="h-3.5 w-3.5" />}
                      Compare
                    </button>
                    <button
                      onClick={() => onNavigate('project-tracking')}
                      className="flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-amber-300"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Profile
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <CompareView
            contractors={compareList}
            selected={selected}
            onSelect={setSelected}
            onNavigate={onNavigate}
          />
        )}
      </div>
      <MicButton />
    </div>
  );
}

function CompareView({
  contractors,
  selected,
  onSelect,
  onNavigate,
}: {
  contractors: Contractor[];
  selected: string | null;
  onSelect: (id: string) => void;
  onNavigate: (id: ScreenId) => void;
}) {
  const rows = [
    { label: 'Quoted Price', key: (c: Contractor) => `₹${c.quotedPrice.toLocaleString('en-IN')}` },
    { label: 'Rating', key: (c: Contractor) => `${c.rating} ★ (${c.reviews})` },
    { label: 'Timeline', key: (c: Contractor) => c.timeline },
    { label: 'Experience', key: (c: Contractor) => c.experience },
    { label: 'Distance', key: (c: Contractor) => c.distance },
    { label: 'Verified', key: (c: Contractor) => (c.verified ? 'Yes' : 'No') },
  ];

  return (
    <div className="mt-6">
      {contractors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-gray-100 py-16 text-center">
          <GitCompare className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Select contractors from the list to compare them side by side.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-full" style={{ display: 'grid', gridTemplateColumns: `120px repeat(${contractors.length}, 1fr)`, gap: '12px' }}>
            {/* Header row */}
            <div></div>
            {contractors.map((c) => (
              <div key={c.id} className="relative rounded-xl bg-gray-100 p-4 text-center">
                <img src={c.photo} alt={c.name} className="mx-auto h-12 w-12 rounded-full object-cover" />
                <p className="mt-2 text-sm font-semibold text-navy-700">{c.name}</p>
                <p className="text-xs text-gray-500">{c.specialization}</p>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <span className="text-xs font-bold text-amber-500">{c.matchScore}%</span>
                  <span className="text-xs text-gray-400">match</span>
                </div>
              </div>
            ))}

            {/* Data rows */}
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <div className="flex items-center px-2 text-xs font-medium text-gray-500">{row.label}</div>
                {contractors.map((c) => (
                  <div key={c.id + row.label} className="flex items-center justify-center rounded-lg bg-gray-50 px-2 py-3 text-sm font-medium text-navy-700">
                    {row.key(c)}
                  </div>
                ))}
              </div>
            ))}

            {/* Select row */}
            <div></div>
            {contractors.map((c) => (
              <div key={c.id} className="flex justify-center px-4 pt-2">
                <button
                  onClick={() => {
                    onSelect(c.id);
                    onNavigate('project-tracking');
                  }}
                  className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                    selected === c.id ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-navy-700 hover:bg-amber-300'
                  }`}
                >
                  {selected === c.id ? (
                    <span className="flex items-center justify-center gap-1"><Check className="h-3.5 w-3.5" /> Selected</span>
                  ) : (
                    'Select'
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
