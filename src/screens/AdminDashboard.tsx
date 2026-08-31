import { useState, useEffect } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Users,
  ShieldCheck,
  Cpu,
  ChevronRight,
  Eye,
  Loader2,
  Trash2,
  Briefcase,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { Logo } from '../components/ui';
import type { ScreenId } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import {
  apiGetAdminContractors,
  apiAdminVerifyContractor,
  apiAdminDeleteContractor,
  apiAdminGetProjects,
  apiAdminDeleteProject,
  type AdminContractorItem,
  type ApiProject,
} from '../lib/api';

type Tab = 'verifications' | 'projects' | 'users' | 'disputes' | 'ai-accuracy';

interface DisputeItem {
  id: string;
  client: string;
  contractor: string;
  issue: string;
  status: string;
  date: string;
}

const defaultDisputes: DisputeItem[] = [
  { id: 'd1', client: 'Arjun Mehta', contractor: 'Suresh Plumbing Works', issue: 'Delay in completion', status: 'Open', date: '11 Aug 2026' },
  { id: 'd2', client: 'Sneha Reddy', contractor: 'Ravi Electricals', issue: 'Material mismatch', status: 'Open', date: '10 Aug 2026' },
  { id: 'd3', client: 'Karthik Iyer', contractor: 'Arun Civil Works', issue: 'Pricing dispute', status: 'Under Review', date: '09 Aug 2026' },
];

const aiClassifications = [
  { id: 'a1', project: 'Kitchen Pipe Leakage & Valve Repair', detected: 'Plumbing', confidence: 94, status: 'correct' },
  { id: 'a2', project: 'Living Room Emulsion Painting', detected: 'Painting', confidence: 91, status: 'correct' },
  { id: 'a3', project: 'Two-Floor Residential Construction', detected: 'Residential Construction', confidence: 98, status: 'correct' },
  { id: 'a4', project: '3-Phase Industrial Panel Wiring', detected: 'Electrical', confidence: 96, status: 'correct' },
  { id: 'a5', project: 'Terrace Waterproofing & Membrane', detected: 'Waterproofing', confidence: 89, status: 'correct' },
];

export function AdminDashboard({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { locale } = useLocale();
  const [tab, setTab] = useState<Tab>('verifications');
  const [contractors, setContractors] = useState<AdminContractorItem[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<AdminContractorItem | null>(null);
  const [disputes] = useState<DisputeItem[]>(defaultDisputes);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [contractorData, projectData] = await Promise.all([
        apiGetAdminContractors().catch(() => []),
        apiAdminGetProjects().then((r) => r.projects).catch(() => []),
      ]);
      setContractors(contractorData);
      setProjects(projectData);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleVerify = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      setActionLoading(id);
      await apiAdminVerifyContractor(id, status);
      setContractors((prev) =>
        prev.map((c) =>
          c._id === id
            ? { ...c, kycStatus: status, isVerified: status === 'VERIFIED' }
            : c
        )
      );
      if (selectedContractor && selectedContractor._id === id) {
        setSelectedContractor((prev) => (prev ? { ...prev, kycStatus: status, isVerified: status === 'VERIFIED' } : null));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating verification');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteContractor = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete contractor "${name}" and all their bids and profile data?`)) {
      return;
    }
    try {
      setActionLoading(id);
      await apiAdminDeleteContractor(id);
      setContractors((prev) => prev.filter((c) => c._id !== id));
      if (selectedContractor && selectedContractor._id === id) {
        setSelectedContractor(null);
      }
      alert(`Contractor "${name}" has been permanently removed.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting contractor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteProject = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete project "${title}" and all its received bids?`)) {
      return;
    }
    try {
      setActionLoading(id);
      await apiAdminDeleteProject(id);
      setProjects((prev) => prev.filter((p) => p._id !== id));
      alert(`Project "${title}" has been permanently removed.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting project');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = contractors.filter((c) => c.kycStatus === 'PENDING').length;
  const verifiedCount = contractors.filter((c) => c.kycStatus === 'VERIFIED' || c.isVerified).length;

  const tabs: { id: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: 'verifications', label: 'Verifications', icon: ShieldCheck, badge: pendingCount },
    { id: 'projects', label: 'All Projects', icon: Briefcase, badge: projects.length },
    { id: 'users', label: 'Users & Roles', icon: Users, badge: contractors.length },
    { id: 'disputes', label: 'Disputes', icon: AlertTriangle, badge: disputes.length },
    { id: 'ai-accuracy', label: 'AI Accuracy', icon: Cpu },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-60 flex-col border-r border-navy-700 bg-navy-600 text-white lg:flex">
        <div className="flex h-16 items-center px-5 border-b border-navy-500/50">
          <Logo size="sm" variant="light" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {tabs.map((tItem) => (
            <button
              key={tItem.id}
              onClick={() => setTab(tItem.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === tItem.id ? 'bg-amber-400 text-navy-950 font-bold shadow-sm' : 'text-white/80 hover:bg-navy-700/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <tItem.icon className="h-5 w-5" strokeWidth={1.75} />
                {tItem.label}
              </div>
              {typeof tItem.badge === 'number' && tItem.badge > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    tab === tItem.id
                      ? 'bg-navy-950 text-amber-400'
                      : 'bg-navy-800 text-amber-400'
                  }`}
                >
                  {tItem.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-navy-500/50 p-3">
          <button
            onClick={() => onNavigate('auth')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-navy-700/60 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" /> {t(locale, 'exitAdmin') || 'Exit Admin'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur-md md:px-6">
          <h1 className="text-lg font-bold text-navy-700">{t(locale, 'adminDashboard') || 'Admin Dashboard'}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="hidden md:inline">Super Admin</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 text-sm font-medium text-white">
              SA
            </div>
          </div>
        </header>

        {/* Mobile tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2 scrollbar-hide lg:hidden">
          {tabs.map((tItem) => (
            <button
              key={tItem.id}
              onClick={() => setTab(tItem.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === tItem.id ? 'bg-navy-600 text-white' : 'text-gray-500'
              }`}
            >
              <tItem.icon className="h-4 w-4" /> {tItem.label}
              {typeof tItem.badge === 'number' && tItem.badge > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] font-bold text-navy-700">
                  {tItem.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          {/* Quick Metrics Bar */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500 uppercase">Total Contractors</p>
              <p className="mt-1 text-2xl font-bold text-navy-700">{contractors.length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500 uppercase">Pending KYC</p>
              <p className="mt-1 text-2xl font-bold text-amber-500">{pendingCount}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500 uppercase">Verified</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{verifiedCount}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500 uppercase">Open Disputes</p>
              <p className="mt-1 text-2xl font-bold text-red-500">{disputes.length}</p>
            </div>
          </div>

          {/* TAB 1: Verifications */}
          {tab === 'verifications' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700">Contractor KYC Verifications</h2>
                  <p className="text-sm text-gray-500">
                    Review and verify submitted contractor identity documents. Only verified contractors receive project recommendations.
                  </p>
                </div>
                <button
                  onClick={fetchAdminData}
                  className="text-xs font-semibold text-navy-600 hover:underline"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-gray-400">Loading contractor records...</div>
              ) : contractors.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                  No contractors registered yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Contractor</th>
                        <th className="hidden px-4 py-3 md:table-cell">Trade / Domain</th>
                        <th className="hidden px-4 py-3 sm:table-cell">City / Area</th>
                        <th className="px-4 py-3">KYC Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractors.map((c) => (
                        <tr key={c._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-600">
                                {c.fullName.split(' ').map((w) => w[0]).join('')}
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-navy-700 block">{c.fullName}</span>
                                <span className="text-xs text-gray-400">{c.phone || c.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3.5 text-sm text-gray-600 md:table-cell">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              {c.trade}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3.5 text-sm text-gray-500 sm:table-cell">
                            {c.city || 'Tamil Nadu'}
                          </td>
                          <td className="px-4 py-3.5">
                            {c.kycStatus === 'VERIFIED' || c.isVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                                <Check className="h-3 w-3" /> Verified
                              </span>
                            ) : c.kycStatus === 'REJECTED' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                                <X className="h-3 w-3" /> Rejected
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedContractor(c)}
                                className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-navy-600 hover:bg-gray-50"
                              >
                                <Eye className="h-3.5 w-3.5" /> View Docs
                              </button>
                              <button
                                onClick={() => handleVerify(c._id, 'VERIFIED')}
                                disabled={actionLoading === c._id}
                                title="Approve & Verify Contractor"
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {actionLoading === c._id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" strokeWidth={2.5} />
                                )}
                              </button>
                              <button
                                onClick={() => handleVerify(c._id, 'REJECTED')}
                                disabled={actionLoading === c._id}
                                title="Reject Contractor KYC"
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => handleDeleteContractor(c._id, c.fullName)}
                                disabled={actionLoading === c._id}
                                title="Permanently Delete Contractor"
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-red-500 hover:text-white disabled:opacity-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: All Projects Management */}
          {tab === 'projects' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700">All Platform Projects ({projects.length})</h2>
                  <p className="text-sm text-gray-500">
                    Live view of all projects stored in MongoDB. You can inspect project details and delete test or unwanted projects.
                  </p>
                </div>
                <button
                  onClick={fetchAdminData}
                  className="text-xs font-semibold text-navy-600 hover:underline"
                >
                  Refresh Projects
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 bg-white">
                  No projects currently in database.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Project Title</th>
                        <th className="px-4 py-3">Client (Owner)</th>
                        <th className="hidden px-4 py-3 md:table-cell">Location & Budget</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => {
                        const clientName = typeof p.clientId === 'object' && p.clientId ? p.clientId.fullName : 'Client';
                        const clientPhone = typeof p.clientId === 'object' && p.clientId ? p.clientId.phone : '';
                        return (
                          <tr key={p._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3.5">
                              <div>
                                <span className="text-sm font-semibold text-navy-700 block">{p.title}</span>
                                <span className="text-xs text-navy-500">{p.category} · {p.bidsCount || 0} bids</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-700">
                              <span className="font-semibold block">{clientName}</span>
                              <span className="text-xs text-gray-400">{clientPhone}</span>
                            </td>
                            <td className="hidden px-4 py-3.5 text-sm text-gray-600 md:table-cell">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="h-3 w-3" /> {p.location}
                              </div>
                              <span className="font-bold text-emerald-700 text-xs">₹{(p.budget || 0).toLocaleString('en-IN')}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  p.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : p.status === 'IN_PROGRESS'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteProject(p._id, p.title)}
                                disabled={actionLoading === p._id}
                                title="Permanently Delete Project"
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Users & Roles */}
          {tab === 'users' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700">Contractor & Client Accounts</h2>
                  <p className="text-sm text-gray-500">Full list of verified contractors registered in the system.</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Role & Trade</th>
                      <th className="hidden px-4 py-3 md:table-cell">City</th>
                      <th className="hidden px-4 py-3 md:table-cell">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractors.map((c) => (
                      <tr key={c._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-xs font-medium text-navy-600">
                              {c.fullName.split(' ').map((w) => w[0]).join('')}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-navy-700 block">{c.fullName}</span>
                              <span className="text-xs text-gray-400">{c.phone || c.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 block w-max">
                            Contractor
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5 block">{c.trade}</span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-gray-600 md:table-cell">{c.city || 'Coimbatore'}</td>
                        <td className="hidden px-4 py-3.5 text-sm text-emerald-600 font-semibold md:table-cell">
                          {c.isVerified ? 'Verified' : 'Pending'}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteContractor(c._id, c.fullName)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Disputes */}
          {tab === 'disputes' && (
            <div>
              <h2 className="text-xl font-bold text-navy-700">Project Disputes</h2>
              <p className="text-sm text-gray-500">{disputes.length} active disputes filed by clients</p>
              <div className="mt-4 space-y-3">
                {disputes.map((d) => (
                  <div key={d.id} className="rounded-xl border border-gray-100 bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-semibold text-navy-700">{d.issue}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              d.status === 'Open' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {d.client} vs {d.contractor}
                        </p>
                        <p className="text-xs text-gray-400">Filed: {d.date}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy-600 hover:bg-gray-50">
                          View Details
                        </button>
                        <button
                          onClick={() => alert(`Dispute ${d.id} marked resolved.`)}
                          className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-amber-300"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AI Accuracy */}
          {tab === 'ai-accuracy' && (
            <div>
              <h2 className="text-xl font-bold text-navy-700">Groq AI Classification Accuracy</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white p-4 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-navy-700">96.4%</p>
                      <p className="text-xs text-gray-500">Classification Accuracy</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                      <Cpu className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-navy-700">Groq Llama/Qwen</p>
                      <p className="text-xs text-gray-500">Active Model</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-navy-700">&lt; 1.2s</p>
                      <p className="text-xs text-gray-500">Avg Latency</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Project Title</th>
                      <th className="px-4 py-3">Detected Category</th>
                      <th className="hidden px-4 py-3 md:table-cell">Confidence</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiClassifications.map((a) => (
                      <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3.5 text-sm font-medium text-navy-700">{a.project}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">{a.detected}</td>
                        <td className="hidden px-4 py-3.5 text-sm text-gray-500 md:table-cell">{a.confidence}%</td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            Verified Correct
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contractor Details & KYC Document Modal */}
      {selectedContractor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-navy-700">{selectedContractor.fullName}</h3>
                <p className="text-xs text-gray-500">{selectedContractor.phone || selectedContractor.email}</p>
              </div>
              <button onClick={() => setSelectedContractor(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400 block">Primary Trade</span>
                  <span className="font-semibold text-navy-700">{selectedContractor.trade}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Experience</span>
                  <span className="font-semibold text-navy-700">{selectedContractor.experienceYears} Years</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Location</span>
                  <span className="font-semibold text-navy-700">{selectedContractor.city || 'Coimbatore'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">License No</span>
                  <span className="font-semibold text-navy-700">{selectedContractor.licenseNo || 'Not specified'}</span>
                </div>
              </div>

              {selectedContractor.specializations?.length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 block mb-1">Specializations</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedContractor.specializations.map((s) => (
                      <span key={s} className="rounded bg-navy-50 px-2 py-0.5 text-xs text-navy-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-3">
                <h4 className="text-xs font-bold uppercase text-navy-700 mb-2">Submitted KYC Documents</h4>
                <div className="rounded-lg bg-gray-50 p-3 border">
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">Document:</span> {selectedContractor.kycDocumentType || 'Aadhaar Card'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    <span className="font-semibold">ID Number:</span> {selectedContractor.kycDocumentNumber || 'Verified in Records'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5">
                      ✓ Document Attached & Encrypted
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t pt-3">
                <button
                  onClick={() => handleDeleteContractor(selectedContractor._id, selectedContractor.fullName)}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Contractor
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleVerify(selectedContractor._id, 'REJECTED')}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Reject KYC
                  </button>
                  <button
                    onClick={() => handleVerify(selectedContractor._id, 'VERIFIED')}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Approve & Verify
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
