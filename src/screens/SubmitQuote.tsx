import { useState } from 'react';
import { ArrowLeft, Calendar, IndianRupee } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton } from '../components/ui';
import type { ScreenId } from '../types';

export function SubmitQuote({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [price, setPrice] = useState(18500);
  const [days, setDays] = useState(3);
  const [materialsIncluded, setMaterialsIncluded] = useState(true);
  const [availability, setAvailability] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <TopNav avatarName="Rajesh Kumar" avatarSrc="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150" />
      <div className="mx-auto max-w-lg px-4 py-6 md:px-6 md:py-8">
        <button onClick={() => onNavigate('contractor-dashboard')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-navy-700">Submit Quotation</h1>
        <p className="mt-1 text-sm text-gray-500">Kitchen Pipe Repair · Koramangala</p>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-xl bg-emerald-50 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-3 text-lg font-semibold text-navy-700">Quote Submitted!</p>
            <p className="mt-1 text-sm text-gray-500">The client will review and respond shortly.</p>
            <button
              onClick={() => onNavigate('contractor-dashboard')}
              className="mt-4 rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* Quoted price */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-navy-600">Quoted Price</label>
                <span className="flex items-center text-sm font-semibold text-navy-700">
                  <IndianRupee className="h-4 w-4" />{price.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min={1000}
                max={100000}
                step={500}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-400">
                <span>₹1,000</span>
                <span>₹1,00,000</span>
              </div>
            </div>

            {/* Estimated days */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Estimated Days</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDays(Math.max(1, days - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-navy-700">{days} days</span>
                <button
                  onClick={() => setDays(days + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Materials toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-navy-600">Materials Included</p>
                <p className="text-xs text-gray-500">Price covers all materials</p>
              </div>
              <button
                onClick={() => setMaterialsIncluded(!materialsIncluded)}
                className={`relative h-6 w-11 rounded-full transition-colors ${materialsIncluded ? 'bg-amber-400' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform ${materialsIncluded ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Proposal note */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Proposal Note</label>
              <div className="flex items-start rounded-lg border border-gray-200 px-3 py-2 focus-within:border-navy-400">
                <textarea
                  rows={3}
                  placeholder="Describe your approach, materials, and any guarantees..."
                  className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
                <MicInline />
              </div>
            </div>

            {/* Availability date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Availability Date</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-navy-400">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full bg-transparent text-sm text-navy-700 outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => setSubmitted(true)}
              className="w-full rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300"
            >
              Submit Quote
            </button>
          </div>
        )}
      </div>
      <MicButton />
    </div>
  );
}
