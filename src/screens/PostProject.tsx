import { useState } from 'react';
import { MapPin, Upload, FileText, Sparkles, ArrowLeft } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton } from '../components/ui';
import type { ScreenId } from '../types';

export function PostProject({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [budget, setBudget] = useState(20000);
  const [timeline, setTimeline] = useState('Within a week');
  const [category, setCategory] = useState('Plumbing');
  const [categoryEdit, setCategoryEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onNavigate('contractor-results');
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <button onClick={() => onNavigate('client-home')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-navy-700">Post a Project</h1>
        <p className="mt-1 text-sm text-gray-500">Tell us what you need. Our AI will match the right contractors.</p>

        <div className="mt-6 space-y-5">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">Project Title</label>
            <input
              placeholder="e.g. Kitchen pipe leakage repair"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">Description</label>
            <div className="flex items-start rounded-lg border border-gray-200 px-3 py-2 focus-within:border-navy-400">
              <textarea
                rows={3}
                placeholder="Describe the issue in detail..."
                className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
              />
              <MicInline />
            </div>
          </div>

          {/* AI-suggested category */}
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xs text-amber-600">AI Detected Category</p>
                {categoryEdit ? (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    onBlur={() => setCategoryEdit(false)}
                    className="mt-0.5 rounded border border-amber-300 bg-white px-2 py-0.5 text-sm font-semibold text-navy-700 outline-none"
                  >
                    {['Plumbing', 'Electrical', 'Painting', 'Carpentry', 'Interior', 'Masonry'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-navy-700">
                    {category} <span className="font-normal text-gray-500">— 92% confidence</span>
                  </p>
                )}
              </div>
            </div>
            {!categoryEdit && (
              <button onClick={() => setCategoryEdit(true)} className="text-xs font-medium text-navy-500 hover:text-navy-700">
                Edit
              </button>
            )}
          </div>

          {/* Budget slider */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-navy-600">Budget</label>
              <span className="text-sm font-semibold text-navy-700">₹{budget.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={100000}
              step={1000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>₹1,000</span>
              <span>₹1,00,000</span>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">Timeline</label>
            <select
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none focus:border-navy-400"
            >
              <option>Immediate</option>
              <option>Within a week</option>
              <option>Flexible</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">Location</label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
              <MapPin className="h-4 w-4 text-gray-400" />
              <input
                placeholder="Enter your area or pin on map"
                defaultValue="Koramangala, Bengaluru"
                className="w-full bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
              />
            </div>
          </div>

          {/* Photo upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">Project Photos</label>
            <div className="flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-colors hover:border-navy-300 hover:bg-navy-50">
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <Upload className="h-5 w-5" />
                <span className="text-xs">Drag photos or click to upload</span>
              </div>
            </div>
          </div>

          {/* PDF upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-600">Documents (PDF)</label>
            <div className="flex h-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-colors hover:border-navy-300 hover:bg-navy-50">
              <div className="flex items-center gap-2 text-gray-400">
                <FileText className="h-5 w-5" />
                <span className="text-xs">Upload floor plans, quotes, or specs</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300 disabled:opacity-70"
          >
            {submitting ? 'Submitting...' : 'Submit Project'}
          </button>
        </div>
      </div>

      {/* AI Analyzing overlay */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-float animate-scaleIn">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 animate-pulseAmber rounded-full" />
              <div className="flex h-full w-full items-center justify-center rounded-full bg-amber-50">
                <Sparkles className="h-7 w-7 text-amber-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-navy-700">AI is analyzing...</p>
              <p className="mt-1 text-sm text-gray-500">Finding the best contractors for your project</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 rounded-full bg-amber-400"
                  style={{ animation: `pulseAmber 1s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <MicButton />
    </div>
  );
}
