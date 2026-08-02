import { useState } from 'react';
import { Check, X, AlertTriangle, Users, ShieldCheck, Cpu, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Logo } from '../components/ui';
import type { ScreenId } from '../types';

type Tab = 'verifications' | 'disputes' | 'ai-accuracy' | 'users';

const verifications = [
  { id: 'v1', name: 'Rajesh Kumar', spec: 'Plumbing', kyc: 'Pending', date: '12 Aug' },
  { id: 'v2', name: 'Priya Sharma', spec: 'Interior Design', kyc: 'Pending', date: '12 Aug' },
  { id: 'v3', name: 'Mohammed Ali', spec: 'Plumbing', kyc: 'Pending', date: '11 Aug' },
  { id: 'v4', name: 'Anita Verma', spec: 'Drainage', kyc: 'Under Review', date: '10 Aug' },
  { id: 'v5', name: 'Suresh Patel', spec: 'Electrical', kyc: 'Pending', date: '10 Aug' },
];

const disputes = [
  { id: 'd1', client: 'Arjun Mehta', contractor: 'Rajesh Kumar', issue: 'Quality of work', status: 'Open', date: '11 Aug' },
  { id: 'd2', client: 'Sneha Reddy', contractor: 'Priya Sharma', issue: 'Delay in completion', status: 'Open', date: '10 Aug' },
  { id: 'd3', client: 'Karthik Iyer', contractor: 'Mohammed Ali', issue: 'Pricing dispute', status: 'Under Review', date: '09 Aug' },
];

const aiClassifications = [
  { id: 'a1', project: 'Kitchen Pipe Repair', detected: 'Plumbing', confidence: 92, status: 'correct' },
  { id: 'a2', project: 'Wall Painting', detected: 'Painting', confidence: 88, status: 'correct' },
  { id: 'a3', project: 'Bathroom Tiles', detected: 'Masonry', confidence: 71, status: 'misclassified', actual: 'Flooring' },
  { id: 'a4', project: 'Ceiling Fan Install', detected: 'Electrical', confidence: 95, status: 'correct' },
  { id: 'a5', project: 'Water Tank Setup', detected: 'Plumbing', confidence: 64, status: 'misclassified', actual: 'Waterproofing' },
];

const users = [
  { id: 'u1', name: 'Arjun Mehta', role: 'Client', projects: 4, joined: 'Jan 2026' },
  { id: 'u2', name: 'Rajesh Kumar', role: 'Contractor', projects: 127, joined: 'Mar 2025' },
  { id: 'u3', name: 'Sneha Reddy', role: 'Client', projects: 2, joined: 'Jun 2026' },
  { id: 'u4', name: 'Priya Sharma', role: 'Contractor', projects: 203, joined: 'Aug 2024' },
];

export function AdminDashboard({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const [tab, setTab] = useState<Tab>('verifications');

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'verifications', label: 'Verifications', icon: ShieldCheck },
    { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
    { id: 'ai-accuracy', label: 'AI Accuracy', icon: Cpu },
    { id: 'users', label: 'Users', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-60 flex-col border-r border-gray-100 bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo size="sm" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-navy-600 text-white' : 'text-navy-500 hover:bg-navy-50'
              }`}
            >
              <t.icon className="h-5 w-5" strokeWidth={1.75} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-3">
          <button
            onClick={() => onNavigate('auth')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <ChevronRight className="h-5 w-5" /> Exit Admin
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur-md md:px-6">
          <h1 className="text-lg font-bold text-navy-700">Admin Dashboard</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="hidden md:inline">Super Admin</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 text-sm font-medium text-white">SA</div>
          </div>
        </header>

        {/* Mobile tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2 scrollbar-hide lg:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-navy-600 text-white' : 'text-gray-500'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          {/* Verifications */}
          {tab === 'verifications' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-700">Pending Verifications</h2>
                  <p className="text-sm text-gray-500">{verifications.length} contractors awaiting approval</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="hidden px-4 py-3 md:table-cell">Specialization</th>
                      <th className="px-4 py-3">KYC Status</th>
                      <th className="hidden px-4 py-3 md:table-cell">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((v) => (
                      <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-xs font-medium text-navy-600">
                              {v.name.split(' ').map((w) => w[0]).join('')}
                            </div>
                            <span className="text-sm font-medium text-navy-700">{v.name}</span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-gray-600 md:table-cell">{v.spec}</td>
                        <td className="px-4 py-3.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            v.kyc === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-navy-50 text-navy-500'
                          }`}>{v.kyc}</span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-gray-500 md:table-cell">{v.date}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-2">
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                              <Check className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                              <X className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disputes */}
          {tab === 'disputes' && (
            <div>
              <h2 className="text-xl font-bold text-navy-700">Open Disputes</h2>
              <p className="text-sm text-gray-500">{disputes.length} cases need resolution</p>
              <div className="mt-4 space-y-3">
                {disputes.map((d) => (
                  <div key={d.id} className="rounded-xl border border-gray-100 bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-semibold text-navy-700">{d.issue}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.status === 'Open' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
                          }`}>{d.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{d.client} vs {d.contractor}</p>
                        <p className="text-xs text-gray-400">Filed: {d.date}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy-600 hover:bg-gray-50">
                          View Details
                        </button>
                        <button className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-amber-300">
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Accuracy */}
          {tab === 'ai-accuracy' && (
            <div>
              <h2 className="text-xl font-bold text-navy-700">AI Classification Accuracy</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white p-4 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-navy-700">87.3%</p>
                      <p className="text-xs text-gray-500">Overall Accuracy</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                      <Cpu className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-navy-700">1,247</p>
                      <p className="text-xs text-gray-500">Classifications Today</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-navy-700">12.7%</p>
                      <p className="text-xs text-gray-500">Misclassified</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 overflow-hidden rounded-xl border border-gray-100 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Detected</th>
                      <th className="hidden px-4 py-3 md:table-cell">Confidence</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiClassifications.map((a) => (
                      <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3.5 text-sm font-medium text-navy-700">{a.project}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">{a.detected}</td>
                        <td className="hidden px-4 py-3.5 text-sm text-gray-500 md:table-cell">{a.confidence}%</td>
                        <td className="px-4 py-3.5">
                          {a.status === 'correct' ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">Correct</span>
                          ) : (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">
                              Misclassified → {a.actual}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button className="text-xs font-medium text-navy-500 hover:text-navy-700">Override</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div>
              <h2 className="text-xl font-bold text-navy-700">All Users</h2>
              <p className="text-sm text-gray-500">{users.length} registered users</p>
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-100 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="hidden px-4 py-3 md:table-cell">Projects</th>
                      <th className="hidden px-4 py-3 md:table-cell">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-xs font-medium text-navy-600">
                              {u.name.split(' ').map((w) => w[0]).join('')}
                            </div>
                            <span className="text-sm font-medium text-navy-700">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.role === 'Client' ? 'bg-navy-50 text-navy-600' : 'bg-amber-50 text-amber-600'
                          }`}>{u.role}</span>
                        </td>
                        <td className="hidden px-4 py-3.5 text-sm text-gray-600 md:table-cell">{u.projects}</td>
                        <td className="hidden px-4 py-3.5 text-sm text-gray-500 md:table-cell">{u.joined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
