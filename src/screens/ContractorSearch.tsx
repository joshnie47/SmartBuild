import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  X,
  MapPin,
  IndianRupee,
  Calendar,
  Clock,
  Briefcase,
  FileText,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Info,
  ChevronRight,
  Send,
} from 'lucide-react';
import { TopNav } from '../components/TopNav';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiSearchProjects, type ProjectSearchParams, type ApiProject } from '../lib/api';


const PROJECT_CATEGORIES = [
  'All Categories',
  'Civil Construction',
  'Residential Building',
  'Commercial Construction',
  'Interior Design',
  'Renovation & Remodeling',
  'Roofing & Waterproofing',
  'Electrical & Plumbing',
];

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open for Bidding' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ALL', label: 'All Statuses' },
];

export function ContractorSearch({
  onNavigate,
  initialQuery = '',
}: {
  onNavigate: (id: ScreenId, projectId?: string) => void;
  initialQuery?: string;
}) {
  const { locale } = useLocale();

  // Search parameters state
  const [keyword, setKeyword] = useState(initialQuery);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [location, setLocation] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [timeline, setTimeline] = useState('');

  // Results & UI state
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ApiProject | null>(null);

  // Execute search against backend API
  const performSearch = async (overrideParams?: Partial<ProjectSearchParams>) => {
    try {
      setLoading(true);
      setError('');

      const params: ProjectSearchParams = {
        q: overrideParams?.q !== undefined ? overrideParams.q : keyword.trim(),
        title: overrideParams?.title !== undefined ? overrideParams.title : title.trim(),
        category:
          overrideParams?.category !== undefined
            ? overrideParams.category
            : category === 'All Categories'
            ? ''
            : category,
        location: overrideParams?.location !== undefined ? overrideParams.location : location.trim(),
        minBudget:
          overrideParams?.minBudget !== undefined
            ? overrideParams.minBudget
            : minBudget
            ? Number(minBudget)
            : undefined,
        maxBudget:
          overrideParams?.maxBudget !== undefined
            ? overrideParams.maxBudget
            : maxBudget
            ? Number(maxBudget)
            : undefined,
        status: overrideParams?.status !== undefined ? overrideParams.status : status,
        timeline: overrideParams?.timeline !== undefined ? overrideParams.timeline : timeline.trim(),
      };

      const results = await apiSearchProjects(params);
      setProjects(results);
    } catch (err: any) {
      console.error('Contractor Project Search error:', err);
      setError('Unable to perform search. Please try again.');
      setProjects([]);
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
    setTitle('');
    setCategory('All Categories');
    setLocation('');
    setMinBudget('');
    setMaxBudget('');
    setStatus('OPEN');
    setTimeline('');

    performSearch({
      q: '',
      title: '',
      category: '',
      location: '',
      minBudget: undefined,
      maxBudget: undefined,
      status: 'OPEN',
      timeline: '',
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
                onClick={() => onNavigate('contractor-dashboard')}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-navy-700 transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-navy-700">{t(locale, 'searchProjectsTitle')}</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500 ml-9">
              {t(locale, 'searchProjectsSubtitle')}
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
            {/* Main Search Input */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={t(locale, 'searchPlaceholderProject')}
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

            {/* Expanded Filters */}
            {showFilters && (
              <div className="mt-5 border-t border-gray-100 pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Category Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t(locale, 'colRoleTrade')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                  >
                    {PROJECT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'All Categories' ? t(locale, 'allCategories') : cat}
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
                      placeholder="e.g. Coimbatore, Chennai"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-9 pr-3 py-2.5 text-sm text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Min Budget Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t(locale, 'minBudgetLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                  />
                </div>

                {/* Max Budget Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t(locale, 'maxBudgetLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    placeholder="e.g. 2500000"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {t(locale, 'colStatus')}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium text-navy-700 outline-none focus:border-amber-400 focus:bg-white"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value === 'OPEN'
                          ? t(locale, 'openForBidding')
                          : opt.value === 'IN_PROGRESS'
                          ? t(locale, 'inProgress')
                          : opt.value === 'COMPLETED'
                          ? t(locale, 'completed')
                          : t(locale, 'allStatuses')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Results Count Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            {loading ? (
              t(locale, 'fetchingVerificationRecords')
            ) : (
              <>
                {t(locale, 'navOpportunities')}{' '}
                <span className="ml-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-navy-700">
                  {projects.length}
                </span>
              </>
            )}
          </h2>
        </div>

        {/* Results List */}
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
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
            <Briefcase className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-navy-700">{t(locale, 'noProjectsFound')}</h3>
            <button
              onClick={handleClearFilters}
              className="mt-4 rounded-xl bg-navy-50 px-4 py-2 text-xs font-bold text-navy-700 hover:bg-navy-100"
            >
              {t(locale, 'clearFilters')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((p) => {
              const clientObj = typeof p.clientId === 'object' && p.clientId ? (p.clientId as any) : null;
              const clientName = clientObj?.fullName || (p as any).clientName || 'Client';

              return (
                <div
                  key={p._id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-navy-700">{p.title}</h3>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                          {p.category}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            p.status === 'OPEN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs font-medium text-gray-500 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-amber-500" />
                          {p.location} {p.streetArea ? `(${p.streetArea})` : ''}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-bold text-emerald-700">
                          <IndianRupee className="h-3.5 w-3.5" />
                          ₹{p.budget.toLocaleString('en-IN')}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {p.timeline || '90 days'}
                        </span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <span className="inline-block rounded-lg bg-navy-50 px-3 py-1 text-xs font-bold text-navy-700">
                        {p.bidsCount || 0} {(p.bidsCount || 0) === 1 ? 'Bid Received' : 'Bids Received'}
                      </span>
                    </div>
                  </div>

                  {/* Short Description / Requirements */}
                  <p className="mt-3 text-xs text-gray-600 line-clamp-2 leading-relaxed bg-gray-50/70 rounded-xl p-3">
                    {p.description}
                  </p>

                  {/* Card Footer Actions */}
                  <div className="mt-4 border-t border-gray-100 pt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400 font-medium">
                      Posted by <span className="font-semibold text-navy-700">{clientName}</span>
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedProject(p)}
                        className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-navy-700 hover:bg-gray-50"
                      >
                        View Details
                      </button>

                      {p.status === 'OPEN' && (
                        <button
                          onClick={() => onNavigate('submit-quote', p._id)}
                          className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-navy-700 shadow-soft hover:bg-amber-300 transition-all"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Submit Quotation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl scrollbar-thin">
            <button
              onClick={() => setSelectedProject(null)}
              className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                {selectedProject.category}
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                {selectedProject.status}
              </span>
            </div>

            <h2 className="mt-2 text-xl font-bold text-navy-700">{selectedProject.title}</h2>

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-navy-50/60 p-4 text-center">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Budget</p>
                <p className="text-sm font-bold text-emerald-700 mt-0.5">
                  ₹{selectedProject.budget.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="border-x border-navy-100">
                <p className="text-xs font-semibold uppercase text-gray-500">Location</p>
                <p className="text-sm font-bold text-navy-700 mt-0.5 truncate">
                  {selectedProject.location}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Timeline</p>
                <p className="text-sm font-bold text-navy-700 mt-0.5">
                  {selectedProject.timeline || '90 days'}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Project Requirements & Scope</h3>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4">
                {selectedProject.description}
              </p>
            </div>

            <div className="mt-8 border-t border-gray-100 pt-4 flex items-center gap-3">
              {selectedProject.status === 'OPEN' ? (
                <button
                  onClick={() => {
                    const id = selectedProject._id;
                    setSelectedProject(null);
                    onNavigate('submit-quote', id);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-navy-700 shadow-soft hover:bg-amber-300"
                >
                  <Send className="h-4 w-4" />
                  Proceed to Submit Quotation
                </button>
              ) : (
                <p className="flex-1 text-xs font-semibold text-gray-500">This project is currently {selectedProject.status}.</p>
              )}
              <button
                onClick={() => setSelectedProject(null)}
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
