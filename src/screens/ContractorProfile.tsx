import { useState } from 'react';
import { BadgeCheck, Camera, Edit3, Plus } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicInline, MicButton, StarRating } from '../components/ui';
import type { ScreenId } from '../types';

const portfolioImages = [
  'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=400',
];

const specChips = ['Plumbing', 'Waterproofing', 'Drainage', 'Pipe Fitting'];

export function ContractorProfile({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [available, setAvailable] = useState(true);
  const [editingBio, setEditingBio] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <TopNav avatarName="Rajesh Kumar" avatarSrc="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150" />
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8">
        {/* Profile header */}
        <div className="flex items-start gap-4">
          <div className="relative">
            <img
              src="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200"
              alt="Rajesh Kumar"
              className="h-20 w-20 rounded-full object-cover"
            />
            <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-navy-600 text-white shadow-soft">
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy-700">Rajesh Kumar</h1>
              <BadgeCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><StarRating rating={4.8} /> 4.8 (127)</span>
              <span>· 12 yrs experience</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {specChips.map((s) => (
                <span key={s} className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy-600">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Availability toggle */}
        <div className="mt-5 flex items-center justify-between rounded-xl bg-gray-100 p-4">
          <div>
            <p className="text-sm font-semibold text-navy-700">Availability Status</p>
            <p className="text-xs text-gray-500">{available ? 'Accepting new projects' : 'Currently busy'}</p>
          </div>
          <button
            onClick={() => setAvailable(!available)}
            className={`relative h-7 w-12 rounded-full transition-colors ${available ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-soft transition-transform ${available ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Bio */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-navy-600">Bio</label>
            <button
              onClick={() => setEditingBio(!editingBio)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-600"
            >
              <Edit3 className="h-3 w-3" /> Edit
            </button>
          </div>
          {editingBio ? (
            <div className="flex items-start rounded-lg border border-gray-200 px-3 py-2 focus-within:border-navy-400">
              <textarea
                rows={3}
                defaultValue="Experienced plumber specializing in residential and commercial plumbing. 12+ years serving Bengaluru. Certified in modern pipe fitting and waterproofing techniques."
                className="w-full resize-none bg-transparent text-sm text-navy-700 outline-none"
              />
              <MicInline />
            </div>
          ) : (
            <p className="text-sm text-gray-600">Experienced plumber specializing in residential and commercial plumbing. 12+ years serving Bengaluru. Certified in modern pipe fitting and waterproofing techniques.</p>
          )}
        </div>

        {/* Portfolio */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Portfolio</h2>
            <button className="flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-navy-700">
              <Plus className="h-3.5 w-3.5" /> Add Photo
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {portfolioImages.map((img, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                <img src={img} alt={`Portfolio ${i + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </div>
            ))}
            <button className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-gray-200 transition-colors hover:border-navy-300 hover:bg-navy-50">
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <Camera className="h-6 w-6" />
                <span className="text-xs">Add</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      <MicButton />
    </div>
  );
}
