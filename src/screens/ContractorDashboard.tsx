import { IndianRupee, Briefcase, Star, CheckCircle2, QrCode, MapPin, ArrowRight, Upload } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton } from '../components/ui';
import type { ScreenId } from '../types';

const jobMatches = [
  { id: 'j1', title: 'Kitchen Pipe Repair', category: 'Plumbing', budget: '₹15,000–25,000', location: 'Koramangala', time: '2 min ago' },
  { id: 'j2', title: 'Bathroom Waterproofing', category: 'Waterproofing', budget: '₹8,000–12,000', location: 'HSR Layout', time: '15 min ago' },
  { id: 'j3', title: 'Leakage Inspection', category: 'Plumbing', budget: '₹3,000–5,000', location: 'Indiranagar', time: '1 hr ago' },
  { id: 'j4', title: 'Full Bathroom Fitting', category: 'Plumbing', budget: '₹35,000–50,000', location: 'Jayanagar', time: '3 hr ago' },
];

export function ContractorDashboard({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const stats = [
    { label: 'Earnings (This Month)', value: '₹84,500', icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active Jobs', value: '3', icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Rating', value: '4.8', icon: Star, color: 'text-navy-600', bg: 'bg-navy-50' },
    { label: 'Completed', value: '127', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <TopNav avatarName="Rajesh Kumar" avatarSrc="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150" onNavigate={onNavigate} />
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-bold text-navy-700">Welcome, Rajesh</h1>
        <p className="mt-1 text-sm text-gray-500">You have 4 new job matches today.</p>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-gray-100 p-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} strokeWidth={1.75} />
              </div>
              <p className="mt-3 text-2xl font-bold text-navy-700">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* New Job Matches */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">New Job Matches</h2>
          <div className="space-y-3">
            {jobMatches.map((job) => (
              <div key={job.id} className="rounded-xl bg-gray-100 p-4 transition-shadow hover:shadow-soft">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-navy-700">{job.title}</h3>
                      <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-500">{job.category}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span>{job.budget}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                      <span>{job.time}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('submit-quote')}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-amber-300"
                >
                  Submit Quote <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Payment QR card */}
        <div className="mt-8 rounded-xl border border-gray-100 bg-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy-700">Payment QR</h3>
              <p className="mt-0.5 text-xs text-gray-500">Customers scan to pay you directly</p>
            </div>
            <button className="flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-navy-700">
              <Upload className="h-3.5 w-3.5" /> Replace
            </button>
          </div>
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg bg-white p-6">
            <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
              <QrCode className="h-16 w-16 text-gray-300" />
            </div>
            <p className="mt-2 text-xs text-gray-400">Tap replace to upload your UPI QR</p>
          </div>
        </div>
      </div>
      <MicButton />
    </div>
  );
}
