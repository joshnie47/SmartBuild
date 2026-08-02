import { useState } from 'react';
import { AlertTriangle, Upload, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton, StarRating } from '../components/ui';
import type { ScreenId } from '../types';

const TAGS = ['On time', 'Professional', 'Good pricing', 'Quality work', 'Clean site', 'Good communication', 'Friendly'];

export function ReviewDispute({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['On time', 'Professional']);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <div className="mx-auto max-w-xl px-4 py-6 md:px-6 md:py-8">
        <button onClick={() => onNavigate('client-home')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-navy-700">Review Your Project</h1>
        <p className="mt-1 text-sm text-gray-500">Kitchen Pipe Repair · Completed by Rajesh Kumar</p>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-xl bg-emerald-50 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-3 text-lg font-semibold text-navy-700">Thank you for your review!</p>
            <p className="mt-1 text-sm text-gray-500">Your feedback helps us improve our matches.</p>
          </div>
        ) : (
          <>
            {/* Star rating */}
            <div className="mt-6 flex flex-col items-center rounded-xl bg-gray-100 py-6">
              <p className="mb-3 text-sm font-medium text-navy-600">How was your experience?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(i)}
                  >
                    <svg
                      className={`h-9 w-9 transition-colors ${(hover || rating) >= i ? 'text-amber-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {rating === 0 && 'Tap to rate'}
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            </div>

            {/* Review text */}
            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Your Review</label>
              <div className="flex items-start rounded-lg border border-gray-200 px-3 py-2 focus-within:border-navy-400">
                <textarea
                  rows={3}
                  placeholder="Share details about your experience..."
                  className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                />
                <MicInline />
              </div>
            </div>

            {/* Tag chips */}
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-navy-600">Quick highlights</p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'border-navy-600 bg-navy-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={() => setSubmitted(true)}
              className="mt-6 w-full rounded-lg bg-amber-400 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-amber-300"
            >
              Submit Review
            </button>

            {/* Dispute link */}
            <div className="mt-6 border-t border-gray-100 pt-4">
              <button
                onClick={() => setDisputeOpen(!disputeOpen)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-navy-600"
              >
                <AlertTriangle className="h-4 w-4" />
                Raise a Dispute
                {disputeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {disputeOpen && (
                <div className="mt-4 animate-fadeIn space-y-3 rounded-lg bg-gray-100 p-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-navy-600">Issue Category</label>
                    <select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400">
                      <option>Quality of work</option>
                      <option>Delay in completion</option>
                      <option>Pricing dispute</option>
                      <option>Material mismatch</option>
                      <option>Unprofessional behavior</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-navy-600">Description</label>
                    <div className="flex items-start rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:border-navy-400">
                      <textarea
                        rows={2}
                        placeholder="Describe the issue..."
                        className="w-full resize-none bg-transparent text-sm text-navy-700 placeholder-gray-300 outline-none"
                      />
                      <MicInline />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-navy-600">Evidence (photos/docs)</label>
                    <div className="flex h-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-white hover:border-navy-300">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Upload className="h-4 w-4" />
                        <span className="text-xs">Upload evidence</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-full rounded-lg border border-navy-600 py-2.5 text-sm font-semibold text-navy-600 hover:bg-navy-50">
                    Submit Dispute
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <MicButton />
    </div>
  );
}
