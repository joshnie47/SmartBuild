import { useState, useEffect } from 'react';
import { BadgeCheck, Camera, Edit3, Plus, MapPin, Users, Loader2, Save, X } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton, StarRating } from '../components/ui';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiGetContractorProfileMe, apiSaveContractorProfile } from '../lib/api';

const ALL_SPECS = [
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

export function ContractorProfile({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Profile data
  const [fullName, setFullName] = useState('Contractor');
  const [businessName, setBusinessName] = useState('');
  const [primaryTrade, setPrimaryTrade] = useState('Civil Construction');
  const [specializations, setSpecializations] = useState<string[]>(['Civil Construction']);
  const [experienceYears, setExperienceYears] = useState(5);
  const [licenseNo, setLicenseNo] = useState('');
  const [city, setCity] = useState('Coimbatore');
  const [serviceAreas, setServiceAreas] = useState<string[]>(['Gandhipuram', 'RS Puram']);
  const [about, setAbout] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [available, setAvailable] = useState(true);
  const [kycStatus, setKycStatus] = useState<'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const [isVerified, setIsVerified] = useState(false);
  const [rating, setRating] = useState(4.8);
  const [totalReviews, setTotalReviews] = useState(12);
  const [completedProjects, setCompletedProjects] = useState(15);
  const [portfolioImages, setPortfolioImages] = useState<string[]>([
    'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=400',
  ]);

  // Edit draft state
  const [draftBusinessName, setDraftBusinessName] = useState('');
  const [draftPrimaryTrade, setDraftPrimaryTrade] = useState('');
  const [draftSpecializations, setDraftSpecializations] = useState<string[]>([]);
  const [draftExperience, setDraftExperience] = useState(0);
  const [draftLicense, setDraftLicense] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftAreas, setDraftAreas] = useState<string[]>([]);
  const [draftAbout, setDraftAbout] = useState('');
  const [draftTeamSize, setDraftTeamSize] = useState(1);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiGetContractorProfileMe();
      if (res.fullName) setFullName(res.fullName);
      if (res.kycStatus) setKycStatus(res.kycStatus);
      setIsVerified(res.kycStatus === 'VERIFIED');

      if (res.profile) {
        const p = res.profile;
        setBusinessName(p.businessName || '');
        setPrimaryTrade(p.primaryTrade || 'Civil Construction');
        setSpecializations(p.specializations?.length ? p.specializations : [p.primaryTrade || 'Civil Construction']);
        setExperienceYears(p.experienceYears || 0);
        setLicenseNo(p.licenseNo || '');
        setCity(p.city || 'Coimbatore');
        setServiceAreas(p.serviceAreas || ['Coimbatore']);
        setAbout(p.about || '');
        setTeamSize(p.teamSize || 1);
        setAvailable(p.isAvailable !== false);
        setRating(p.averageRating || 4.8);
        setTotalReviews(p.totalReviews || 0);
        setCompletedProjects(p.completedProjects || 0);
        if (p.portfolioImages?.length) setPortfolioImages(p.portfolioImages);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const openEditModal = () => {
    setDraftBusinessName(businessName);
    setDraftPrimaryTrade(primaryTrade);
    setDraftSpecializations([...specializations]);
    setDraftExperience(experienceYears);
    setDraftLicense(licenseNo);
    setDraftCity(city);
    setDraftAreas([...serviceAreas]);
    setDraftAbout(about);
    setDraftTeamSize(teamSize);
    setEditModalOpen(true);
  };

  const handleToggleDraftSpec = (s: string) => {
    setDraftSpecializations((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await apiSaveContractorProfile({
        businessName: draftBusinessName,
        primaryTrade: draftPrimaryTrade || draftSpecializations[0] || 'Civil Construction',
        specializations: draftSpecializations.length ? draftSpecializations : ['Civil Construction'],
        experienceYears: Number(draftExperience) || 0,
        licenseNo: draftLicense,
        city: draftCity || 'Coimbatore',
        serviceAreas: draftAreas.length ? draftAreas : [draftCity || 'Coimbatore'],
        about: draftAbout,
        teamSize: Number(draftTeamSize) || 1,
        isAvailable: available,
        portfolioImages,
      });

      await fetchProfile();
      setEditModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async () => {
    const nextAvailable = !available;
    setAvailable(nextAvailable);
    try {
      await apiSaveContractorProfile({
        businessName,
        primaryTrade,
        specializations,
        experienceYears,
        city,
        serviceAreas,
        about,
        isAvailable: nextAvailable,
        portfolioImages,
      });
    } catch {
      // Revert on error
      setAvailable(!nextAvailable);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <TopNav avatarName={fullName} onNavigate={onNavigate} />
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8">
        {/* Profile header */}
        <div className="flex items-start gap-4">
          <div className="relative">
            <img
              src="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200"
              alt={fullName}
              className="h-20 w-20 rounded-full object-cover"
            />
            <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-navy-600 text-white shadow-soft">
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-navy-700">{fullName}</h1>
              {isVerified ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" /> {t(locale, 'verifiedBadge') || 'Verified'}
                </span>
              ) : kycStatus === 'REJECTED' ? (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                  KYC Rejected
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
                  KYC Pending
                </span>
              )}
            </div>

            {businessName && (
              <p className="text-sm font-semibold text-navy-600 mt-0.5">{businessName}</p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <StarRating rating={rating} /> {rating} ({totalReviews})
              </span>
              <span>· {experienceYears} yrs experience</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-amber-500" /> {city}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {specializations.map((s) => (
                <span key={s} className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy-600">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button: Edit Profile Details */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={openEditModal}
            className="flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-700 shadow-sm hover:bg-navy-50"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit Profile Details
          </button>
        </div>

        {/* Availability toggle */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-100 p-4">
          <div>
            <p className="text-sm font-semibold text-navy-700">Availability Status</p>
            <p className="text-xs text-gray-500">
              {available ? 'Accepting new project quotations' : 'Currently busy / Unavailable'}
            </p>
          </div>
          <button
            onClick={handleToggleAvailability}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              available ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-soft transition-transform ${
                available ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Service Areas & Team Size Overview */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">Service Areas</p>
            <p className="mt-1 text-sm font-medium text-navy-700">
              {serviceAreas.length ? serviceAreas.join(', ') : city}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">Team & Experience</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-navy-700">
              <Users className="h-4 w-4 text-gray-400" /> {teamSize} Members · {completedProjects} Done
            </p>
          </div>
        </div>

        {/* Bio */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-navy-600">About / Bio</label>
            <button
              onClick={openEditModal}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-600"
            >
              <Edit3 className="h-3 w-3" /> Edit
            </button>
          </div>
          <p className="text-sm text-gray-600 rounded-lg bg-gray-50 p-3 border border-gray-100">
            {about || `Experienced contractor in ${primaryTrade} with ${experienceYears} years of work experience in ${city}.`}
          </p>
        </div>

        {/* Portfolio */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Portfolio & Past Projects</h2>
            <button
              onClick={() => alert('Photo upload simulated successfully.')}
              className="flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-navy-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add Photo
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {portfolioImages.map((img, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                <img
                  src={img}
                  alt={`Portfolio ${i + 1}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
            ))}
            <button
              onClick={() => alert('Photo upload simulated successfully.')}
              className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-gray-200 transition-colors hover:border-navy-300 hover:bg-navy-50"
            >
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <Camera className="h-6 w-6" />
                <span className="text-xs">Add</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-navy-700">Edit Contractor Profile</h3>
              <button onClick={() => setEditModalOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-navy-700 mb-1">Business Name</label>
                <input
                  type="text"
                  value={draftBusinessName}
                  onChange={(e) => setDraftBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-navy-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">Primary Trade</label>
                  <select
                    value={draftPrimaryTrade}
                    onChange={(e) => setDraftPrimaryTrade(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                  >
                    {ALL_SPECS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    min={0}
                    value={draftExperience}
                    onChange={(e) => setDraftExperience(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-700 mb-1">Specializations / Trades Offered</label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border rounded-lg">
                  {ALL_SPECS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleToggleDraftSpec(s)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        draftSpecializations.includes(s)
                          ? 'bg-navy-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">Base City</label>
                  <input
                    type="text"
                    value={draftCity}
                    onChange={(e) => setDraftCity(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">License No.</label>
                  <input
                    type="text"
                    value={draftLicense}
                    onChange={(e) => setDraftLicense(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-700 mb-1">Service Areas (comma-separated)</label>
                <input
                  type="text"
                  value={draftAreas.join(', ')}
                  onChange={(e) => setDraftAreas(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-700 mb-1">About / Bio</label>
                <textarea
                  rows={3}
                  value={draftAbout}
                  onChange={(e) => setDraftAbout(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-5 py-2 text-sm font-semibold text-navy-700 hover:bg-amber-300 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MicButton />
    </div>
  );
}
