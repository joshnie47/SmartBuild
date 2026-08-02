import { useState } from 'react';
import { ArrowRight, ArrowLeft, Upload, Check, Clock, ShieldCheck, MapPin, Users } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import type { ScreenId } from '../types';

const SPECIALIZATIONS = ['Plumbing', 'Electrical', 'Painting', 'Carpentry', 'Interior Design', 'Masonry', 'Roofing', 'Flooring', 'HVAC', 'Waterproofing'];
const SERVICE_AREAS = ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'Jayanagar', 'BTM Layout'];

export function ContractorOnboarding({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [step, setStep] = useState(1);
  const [specs, setSpecs] = useState<string[]>(['Plumbing', 'Waterproofing']);
  const [areas, setAreas] = useState<string[]>(['Koramangala', 'HSR Layout']);
  const [teamSize, setTeamSize] = useState(4);

  const toggleSpec = (s: string) => setSpecs((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  const toggleArea = (a: string) => setAreas((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a]);

  return (
    <div className="min-h-screen bg-white">
      <TopNav showSearch={false} avatarName="New Contractor" />
      <div className="mx-auto max-w-lg px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-bold text-navy-700">Contractor Onboarding</h1>
        <p className="mt-1 text-sm text-gray-500">Complete your profile to start receiving job matches.</p>

        {/* Progress dots */}
        <div className="mt-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                s < step ? 'bg-emerald-500 text-white' : s === step ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {s < step ? <Check className="h-4 w-4" strokeWidth={3} /> : s}
              </div>
              {s < 3 && <div className={`h-0.5 flex-1 rounded ${s < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Business details */}
        {step === 1 && (
          <div className="mt-6 animate-fadeIn space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Business Name</label>
              <input
                placeholder="e.g. Kumar Plumbing Services"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">Years in Business</label>
                <input
                  type="number"
                  defaultValue={12}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none focus:border-navy-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">License No.</label>
                <input
                  placeholder="KA-PL-2024"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy-600">Specializations</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSpec(s)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      specs.includes(s) ? 'border-navy-600 bg-navy-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: KYC */}
        {step === 2 && (
          <div className="mt-6 animate-fadeIn space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-amber-600">Your documents are encrypted and securely stored.</p>
            </div>
            {[
              { label: 'Aadhaar Card', desc: 'Front and back' },
              { label: 'PAN Card', desc: 'Both sides' },
              { label: 'Contractor License', desc: 'Valid license copy' },
            ].map((doc) => (
              <div key={doc.label}>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">{doc.label}</label>
                <div className="flex h-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-colors hover:border-navy-300 hover:bg-navy-50">
                  <div className="flex flex-col items-center gap-1 text-gray-400">
                    <Upload className="h-5 w-5" />
                    <span className="text-xs">{doc.desc} — drag or click</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-500">Verification status: <span className="font-medium text-amber-600">Pending</span></p>
            </div>
          </div>
        )}

        {/* Step 3: Service areas */}
        {step === 3 && (
          <div className="mt-6 animate-fadeIn space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-navy-600">Service Areas</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_AREAS.map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleArea(a)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      areas.includes(a) ? 'border-navy-600 bg-navy-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <MapPin className="h-3 w-3" /> {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Team Size</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTeamSize(Math.max(1, teamSize - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="flex items-center gap-1.5 text-lg font-semibold text-navy-700">
                  <Users className="h-5 w-5 text-gray-400" /> {teamSize} members
                </span>
                <button
                  onClick={() => setTeamSize(teamSize + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
                <Check className="h-6 w-6 text-white" strokeWidth={3} />
              </div>
              <p className="mt-2 text-sm font-semibold text-navy-700">Profile Complete!</p>
              <p className="text-xs text-gray-500">Your verification is pending. We'll notify you within 48 hours.</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => onNavigate('contractor-dashboard')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
            >
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
