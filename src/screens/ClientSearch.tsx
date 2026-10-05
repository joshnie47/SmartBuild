import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  X,
  BadgeCheck,
  MapPin,
  Briefcase,
  Star,
  CheckCircle2,
  Award,
  Loader2,
  Building2,
  ArrowLeft,
  UserCheck,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { TopNav } from '../components/TopNav';
import type { ScreenId, PortfolioItem, PortfolioAuthenticitySummary } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiSearchContractors, type ContractorSearchParams, type ApiContractor } from '../lib/api';


const COMMON_SPECIALIZATIONS = [
  'All Categories',
  'Civil Construction',
  'Residential Construction',
  'Electrical',
  'Plumbing',
  'Interior Design',
  'Roofing',
  'Waterproofing',
  'Masonry',
  'Carpentry',
];

export function ClientSearch({
  onNavigate,
  initialQuery = '',
}: {
  onNavigate: (id: ScreenId, projectId?: string) => void;
  initialQuery?: string;
}) {
  const { locale } = useLocale();

  // Search parameters state
  const [keyword, setKeyword] = useState(initialQuery);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [specialization, setSpecialization] = useState('All Categories');
  const [location, setLocation] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [services, setServices] = useState('');

  // Results & UI state
  const [contractors, setContractors] = useState<ApiContractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedContractor, setSelectedContractor] = useState<ApiContractor | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Function to execute search against backend API
  const performSearch = async (overrideParams?: Partial<ContractorSearchParams>) => {
    try {
      setLoading(true);
      setError('');

      const params: ContractorSearchParams = {
        q: overrideParams?.q !== undefined ? overrideParams.q : keyword.trim(),
        name: overrideParams?.name !== undefined ? overrideParams.name : name.trim(),
        companyName: overrideParams?.companyName !== undefined ? overrideParams.companyName : companyName.trim(),
        specialization:
          overrideParams?.specialization !== undefined
            ? overrideParams.specialization
            : specialization === 'All Categories'
            ? ''
            : specialization,
        location: overrideParams?.location !== undefined ? overrideParams.location : location.trim(),
        minExperience:
          overrideParams?.minExperience !== undefined
            ? overrideParams.minExperience
            : minExperience
            ? Number(minExperience)
            : undefined,
        verifiedOnly:
          overrideParams?.verifiedOnly !== undefined ? overrideParams.verifiedOnly : verifiedOnly,
        services: overrideParams?.services !== undefined ? overrideParams.services : services.trim(),
      };

      const results = await apiSearchContractors(params);
      setContractors(results);
    } catch (err: any) {
      console.error('Client Search error:', err);
      setError('Unable to perform search. Please try again.');
      setContractors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performSearch();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleClearFilters = () => {
    setKeyword('');
    setName('');
    setCompanyName('');
    setSpecialization('All Categories');
    setLocation('');
    setMinExperience('');
    setVerifiedOnly(false);
    setServices('');

    performSearch({
      q: '',
      name: '',
      companyName: '',
      specialization: '',
      location: '',
      minExperience: undefined,
      verifiedOnly: false,
      services: '',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <TopNav onNavigate={onNavigate} />

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('client-home')}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-navy-700 transition-colors"
                title="Back to Home"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-navy-700">{t(locale, 'searchContractorsTitle')}</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500 ml-9">
              {t(locale, 'searchContractorsSubtitle')}
            </p>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 shadow-sm hover:bg-gray-50 transition-all"
          >
            <Filter className="h-4 w-4 text-amber-500" />
            {showFilters ? t(locale, 'filterBtn') : t(locale, 'filterBtn')}
          </button>
        </div>

        {/* Search & Filter Panel */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 md:p-6 shadow-card">
          <form onSubmit={handleSearchSubmit}>
            {/* Search Input Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={t(locale, 'searchPlaceholderContractor')}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-11 pr-4 py-3 text-sm text-navy-700 placeholder-gray-400 outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20"
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => setKeyword('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex w-full sm:w-auto items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-navy-700 shadow-soft transition-all hover:bg-amber-300 active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {t(locale, 'searchBtn')}
                </button>

                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {t(locale, 'clearFilters')}
                </button>
              </div>
            </div>

            {/* Filter Controls Grid */}
            {showFilters && (
              <div className="mt-5 border-t border-gray-100 pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Specialization Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t(locale, 'colRoleTrade')}
                  </label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                  >
                    {COMMON_SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>
                        {s === 'All Categories' ? t(locale, 'allCategories') : s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t(locale, 'colCityArea')}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Chennai, Coimbatore"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-9 pr-3 py-2.5 text-sm text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Person or Company Name Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t(locale, 'colNameContact')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vishnu Works, Arun"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                  />
                </div>

                {/* Min Experience Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t(locale, 'minExperienceLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={minExperience}
                    onChange={(e) => setMinExperience(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                  />
                </div>

                {/* Verification Toggle */}
                <div className="sm:col-span-2 flex items-center gap-3 pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verifiedOnly}
                      onChange={(e) => setVerifiedOnly(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className="ml-3 text-sm font-semibold text-navy-700 flex items-center gap-1.5">
                      <BadgeCheck className="h-4 w-4 text-emerald-500" />
                      {t(locale, 'verifiedOnlyLabel')}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Search Results Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            {loading ? (
              t(locale, 'fetchingVerificationRecords')
            ) : (
              <>
                {t(locale, 'recommendedContractors')}{' '}
                <span className="ml-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-navy-700">
                  {contractors.length}
                </span>
              </>
            )}
          </h2>
        </div>

        {/* Results Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-3" />
            <p className="text-base font-semibold text-navy-700">{t(locale, 'loading')}</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center text-red-600 shadow-sm">
            <Info className="mx-auto h-8 w-8 text-red-400 mb-2" />
            <p className="font-semibold text-sm">{error}</p>
            <button
              onClick={() => performSearch()}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              {t(locale, 'refresh')}
            </button>
          </div>
        ) : contractors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
            <UserCheck className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-navy-700">{t(locale, 'noContractorsFound')}</h3>
            <button
              onClick={handleClearFilters}
              className="mt-4 rounded-xl bg-navy-50 px-4 py-2 text-xs font-bold text-navy-700 hover:bg-navy-100"
            >
              {t(locale, 'clearFilters')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contractors.map((c) => {
              const isVerified = (c as any).isVerified || (c as any).verified;
              const businessName = (c as any).businessName || (c as any).companyName || '';
              const expYears = (c as any).experienceYears || (c as any).experience || '5 years';
              const cityLoc = (c as any).city || (c as any).location || 'Coimbatore';
              const spec = (c as any).primaryTrade || (c as any).specialization || 'Construction';
              const rating = (c as any).averageRating || (c as any).rating || 4.8;
              const completedJobs = (c as any).completedProjects || 12;
              const authSummary = (c as any).portfolioAuthenticity;

              return (
                <div
                  key={c._id}
                  className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-card hover:shadow-lg transition-all"
                >
                  <div>
                    {/* Top Row: Avatar + Name + Verification */}
                    <div className="flex items-start gap-3.5">
                      <img
                        src={c.profileImage || (c as any).photo || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200'}
                        alt={c.fullName}
                        className="h-14 w-14 rounded-xl object-cover border border-gray-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-base font-bold text-navy-700 truncate">
                            {c.fullName}
                          </h3>
                          {isVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                              Verified
                            </span>
                          )}
                        </div>

                        {businessName && businessName !== c.fullName && (
                          <p className="text-xs font-semibold text-navy-600 truncate mt-0.5">
                            🏢 {businessName}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-gray-500 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-amber-600">{spec}</span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            {cityLoc}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Stats Pill Row */}
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-2.5 text-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Experience</p>
                        <p className="text-xs font-bold text-navy-700 mt-0.5">
                          {typeof expYears === 'number' ? `${expYears} yrs` : expYears}
                        </p>
                      </div>
                      <div className="border-x border-gray-200/60">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Rating</p>
                        <p className="text-xs font-bold text-navy-700 mt-0.5 flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {Number(rating).toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Completed</p>
                        <p className="text-xs font-bold text-navy-700 mt-0.5">
                          {completedJobs} Jobs
                        </p>
                      </div>
                    </div>

                    {/* Specializations & Services */}
                    {(c as any).specializations && (c as any).specializations.length > 0 && (
                      <div className="mt-3.5 flex flex-wrap gap-1.5">
                        {(c as any).specializations.slice(0, 4).map((s: string) => (
                          <span
                            key={s}
                            className="rounded-lg bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy-600"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Portfolio Authenticity badge if available */}
                    {authSummary && authSummary.label && (
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium bg-emerald-50/70 rounded-lg px-2.5 py-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{authSummary.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-5 border-t border-gray-100 pt-3.5 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedContractor(c)}
                      className="flex-1 rounded-xl bg-navy-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-navy-700 shadow-soft"
                    >
                      View Profile & Contact
                    </button>
                    <button
                      onClick={() => onNavigate('post-project')}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
                    >
                      Invite
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Contractor Profile Detail Modal */}
      {selectedContractor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl scrollbar-thin">
            <button
              onClick={() => setSelectedContractor(null)}
              className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Profile Header */}
            <div className="flex items-start gap-4">
              <img
                src={
                  selectedContractor.profileImage ||
                  (selectedContractor as any).photo ||
                  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200'
                }
                alt={selectedContractor.fullName}
                className="h-20 w-20 rounded-2xl object-cover border border-gray-100 shadow-soft"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-navy-700">{selectedContractor.fullName}</h2>
                  {((selectedContractor as any).isVerified || (selectedContractor as any).verified) && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                      <BadgeCheck className="h-4 w-4 text-emerald-500" /> Verified
                    </span>
                  )}
                </div>
                {(selectedContractor as any).businessName && (
                  <p className="text-sm font-semibold text-navy-600 mt-0.5">
                    🏢 {(selectedContractor as any).businessName}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500 flex items-center gap-3">
                  <span className="font-semibold text-amber-600">
                    {(selectedContractor as any).primaryTrade || selectedContractor.specialization}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {(selectedContractor as any).city || (selectedContractor as any).location || 'Coimbatore'}
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-navy-50/60 p-4 text-center">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Experience</p>
                <p className="text-sm font-bold text-navy-700 mt-0.5">
                  {(selectedContractor as any).experienceYears || 5} Years
                </p>
              </div>
              <div className="border-x border-navy-100">
                <p className="text-xs font-semibold uppercase text-gray-500">Rating</p>
                <p className="text-sm font-bold text-navy-700 mt-0.5 flex items-center justify-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {((selectedContractor as any).averageRating || (selectedContractor as any).rating || 4.8).toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Completed Jobs</p>
                <p className="text-sm font-bold text-navy-700 mt-0.5">
                  {(selectedContractor as any).completedProjects || 12} Projects
                </p>
              </div>
            </div>

            {/* About */}
            {(selectedContractor as any).about && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">About Contractor</h3>
                <p className="mt-1.5 text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3.5">
                  {(selectedContractor as any).about}
                </p>
              </div>
            )}

            {/* Specializations & Services */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Specializations & Services</h3>
              <div className="flex flex-wrap gap-2">
                {((selectedContractor as any).specializations || [(selectedContractor as any).primaryTrade || 'Construction']).map((s: string) => (
                  <span key={s} className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Service Areas */}
            {(selectedContractor as any).serviceAreas && (selectedContractor as any).serviceAreas.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Service Areas</h3>
                <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-amber-500" />
                  {(selectedContractor as any).serviceAreas.join(', ')}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 border-t border-gray-100 pt-4 flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedContractor(null);
                  onNavigate('post-project');
                }}
                className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-bold text-navy-700 shadow-soft hover:bg-amber-300"
              >
                Post Project & Invite Contractor
              </button>
              <button
                onClick={() => setSelectedContractor(null)}
                className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
