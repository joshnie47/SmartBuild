import { useState } from 'react';
import { ArrowRight, ArrowLeft, Upload, Check, Clock, ShieldCheck, MapPin, Users, Loader2 } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiSaveContractorProfile } from '../lib/api';

const SPECIALIZATIONS = [
  'Civil Construction',
  'Residential Construction',
  'Commercial Construction',
  'Road & Infrastructure',
  'Plumbing',
  'Electrical',
  'Painting',
  'Carpentry',
  'Masonry',
  'Interior Design',
  'Roofing',
  'Flooring',
  'HVAC',
  'Waterproofing',
  'Landscaping',
  'Demolition',
  'Renovation',
  'Structural Work',
];

const SERVICE_AREAS = ['Coimbatore', 'Gandhipuram', 'RS Puram', 'Peelamedu', 'Saravanampatti', 'Singanallur', 'Kovaipudur', 'Sundarapuram'];

export function ContractorOnboarding({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { locale } = useLocale();
  const [step, setStep] = useState(1);

  // Form states
  const [businessName, setBusinessName] = useState('');
  const [years, setYears] = useState(5);
  const [licenseNo, setLicenseNo] = useState('');
  const [specs, setSpecs] = useState<string[]>(['Civil Construction', 'Masonry']);
  const [city, setCity] = useState('Coimbatore');
  const [areas, setAreas] = useState<string[]>(['Gandhipuram', 'RS Puram']);
  const [teamSize, setTeamSize] = useState(4);
  const [docType, setDocType] = useState('Aadhaar Card');
  const [docNumber, setDocNumber] = useState('');
  const [uploadedDocNames, setUploadedDocNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleSpec = (s: string) => setSpecs((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const toggleArea = (a: string) => setAreas((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));

  const handleSimulateDocUpload = (label: string) => {
    if (!uploadedDocNames.includes(label)) {
      setUploadedDocNames((prev) => [...prev, label]);
    }
  };

  const handleSubmitOnboarding = async () => {
    setLoading(true);
    setError('');
    try {
      await apiSaveContractorProfile({
        businessName: businessName.trim() || 'Contractor Services',
        primaryTrade: specs[0] || 'Civil Construction',
        specializations: specs.length ? specs : ['Civil Construction'],
        experienceYears: Number(years) || 0,
        licenseNo: licenseNo.trim(),
        city: city.trim() || 'Coimbatore',
        serviceAreas: areas.length ? areas : [city.trim() || 'Coimbatore'],
        about: `Professional contractor providing quality ${specs.join(', ')} services in ${city}.`,
        teamSize: Number(teamSize) || 1,
        kycDocumentType: docType,
        kycDocumentNumber: docNumber.trim() || 'DOC-VERIFY-2026',
        kycDocumentUrls: [
          'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
        ],
        portfolioImages: [
          'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
          'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=400',
        ],
      });

      onNavigate('contractor-dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save onboarding details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav showSearch={false} avatarName="New Contractor" onNavigate={onNavigate} />
      <div className="mx-auto max-w-lg px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-bold text-navy-700">{t(locale, 'contractorOnboardingTitle') || 'Contractor Onboarding'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t(locale, 'contractorOnboardingSubtitle') || 'Complete your profile to start receiving job matches.'}
        </p>

        {/* Progress dots */}
        <div className="mt-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  s < step
                    ? 'bg-emerald-500 text-white'
                    : s === step
                    ? 'bg-navy-600 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {s < step ? <Check className="h-4 w-4" strokeWidth={3} /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 flex-1 rounded ${
                    s < step ? 'bg-emerald-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Step 1: Business details */}
        {step === 1 && (
          <div className="mt-6 animate-fadeIn space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">
                {t(locale, 'businessName') || 'Business Name'}
              </label>
              <input
                placeholder="e.g. Kumar Civil & Construction Works"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">
                  {t(locale, 'yearsInBusiness') || 'Years in Business'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none focus:border-navy-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">
                  {t(locale, 'licenseNo') || 'License No. (Optional)'}
                </label>
                <input
                  placeholder="TN-CIVIL-2024"
                  value={licenseNo}
                  onChange={(e) => setLicenseNo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 placeholder-gray-300 outline-none focus:border-navy-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-navy-600">
                {t(locale, 'specializations') || 'Specializations / Construction Domain'}
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpec(s)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      specs.includes(s)
                        ? 'border-navy-600 bg-navy-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
              <p className="text-sm text-amber-600">
                {t(locale, 'kycSecurityNote') || 'Your documents are encrypted and securely stored for Admin KYC.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none"
                >
                  <option>Aadhaar Card</option>
                  <option>PAN Card</option>
                  <option>Contractor License</option>
                  <option>GST Certificate</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-600">Document / ID Number</label>
                <input
                  placeholder="e.g. 5432-8765-9012"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none"
                />
              </div>
            </div>

            {[
              { label: 'Aadhaar Card', desc: 'Front and back' },
              { label: 'PAN Card', desc: 'Both sides' },
              { label: 'Contractor License', desc: 'Valid license copy' },
            ].map((doc) => {
              const isUploaded = uploadedDocNames.includes(doc.label);
              return (
                <div key={doc.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium text-navy-600">{doc.label}</label>
                    {isUploaded && <span className="text-xs font-semibold text-emerald-600">✓ Uploaded</span>}
                  </div>
                  <div
                    onClick={() => handleSimulateDocUpload(doc.label)}
                    className={`flex h-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                      isUploaded
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-gray-200 hover:border-navy-300 hover:bg-navy-50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <Upload className={`h-5 w-5 ${isUploaded ? 'text-emerald-500' : ''}`} />
                      <span className="text-xs text-gray-500">{doc.desc} — click to attach</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-500">
                Initial KYC Status: <span className="font-medium text-amber-600">Pending Review</span>
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Service areas & Team */}
        {step === 3 && (
          <div className="mt-6 animate-fadeIn space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-600">Base City</label>
              <input
                placeholder="Coimbatore"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-700 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-navy-600">Service Areas Covered</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_AREAS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleArea(a)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      areas.includes(a)
                        ? 'border-navy-600 bg-navy-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
                  type="button"
                  onClick={() => setTeamSize(Math.max(1, teamSize - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-navy-600 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="flex items-center gap-1.5 text-lg font-semibold text-navy-700">
                  <Users className="h-5 w-5 text-gray-400" /> {teamSize} members
                </span>
                <button
                  type="button"
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
              <p className="mt-2 text-sm font-semibold text-navy-700">Ready to Submit Profile!</p>
              <p className="text-xs text-gray-500">
                Once submitted, Admin will review your KYC documents. You can access your dashboard right away.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitOnboarding}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-navy-700" />
              ) : (
                <>
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
