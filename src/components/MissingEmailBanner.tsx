import { useState } from 'react';
import { Mail, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { apiUpdateEmail } from '../lib/api';

interface MissingEmailBannerProps {
  onEmailUpdated: (updatedEmail: string) => void;
}

export function MissingEmailBanner({ onEmailUpdated }: MissingEmailBannerProps) {
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    setLoading(true);
    try {
      const res = await apiUpdateEmail(cleanEmail);
      setSuccessMsg('Email updated successfully! Registered in MongoDB Atlas.');
      setTimeout(() => {
        onEmailUpdated(res.user.email);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (successMsg) {
    return (
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold">{successMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 sm:p-5 shadow-sm transition-all">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-700 shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-navy-900">Add Your Email Address</h4>
            <p className="mt-0.5 text-xs text-navy-600">
              Add your email address to enable secure PIN recovery and receive important SmartBuild notifications.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:shrink-0">
          <div className="relative flex-1 sm:w-64">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="email"
              placeholder="Enter your email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full rounded-lg border border-amber-200 bg-white py-2 pl-9 pr-3 text-xs text-navy-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors disabled:opacity-60 shrink-0"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Update Email <ArrowRight className="h-3.5 w-3.5" /></>}
          </button>
        </form>
      </div>

      {error && (
        <p className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1 pl-10">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
