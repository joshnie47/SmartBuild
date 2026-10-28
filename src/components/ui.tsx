import { useState } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-scaleIn rounded-2xl bg-white p-6 shadow-float">
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-navy-700">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ status, label }: { status: 'completed' | 'current' | 'upcoming' | 'planning' | 'progress' | 'review'; label: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-600',
    current: 'bg-amber-100 text-amber-600',
    upcoming: 'bg-gray-100 text-gray-500',
    planning: 'bg-navy-50 text-navy-500',
    progress: 'bg-amber-50 text-amber-600',
    review: 'bg-navy-100 text-navy-600',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {label}
    </span>
  );
}

export function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`${px} ${i <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

const LETTER_COLORS: Record<string, { bg: string; border: string }> = {
  A: { bg: '#2563EB', border: '#1E3A8A' }, // Blue (Arun Kumar)
  B: { bg: '#7C3AED', border: '#4C1D95' }, // Purple
  C: { bg: '#059669', border: '#064E3B' }, // Emerald
  D: { bg: '#D97706', border: '#78350F' }, // Amber
  E: { bg: '#0D9488', border: '#134E4A' }, // Teal
  F: { bg: '#E11D48', border: '#881337' }, // Rose
  G: { bg: '#4F46E5', border: '#312E81' }, // Indigo
  H: { bg: '#0891B2', border: '#164E63' }, // Cyan
  I: { bg: '#9333EA', border: '#581C87' }, // Violet
  J: { bg: '#EA580C', border: '#7C2D12' }, // Orange
  K: { bg: '#1D4ED8', border: '#1E3A8A' }, // Deep Blue (Karthik Raja)
  L: { bg: '#16A34A', border: '#14532D' }, // Green
  M: { bg: '#4A7BB0', border: '#1E293B' }, // Slate Blue (Mohana - matches user reference)
  N: { bg: '#6366F1', border: '#312E81' }, // Indigo
  O: { bg: '#D97706', border: '#78350F' }, // Amber
  P: { bg: '#DB2777', border: '#831843' }, // Pink
  Q: { bg: '#7C3AED', border: '#4C1D95' }, // Purple
  R: { bg: '#2563EB', border: '#1E3A8A' }, // Blue (Rajesh)
  S: { bg: '#0D9488', border: '#134E4A' }, // Teal
  T: { bg: '#0284C7', border: '#075985' }, // Sky
  U: { bg: '#4F46E5', border: '#312E81' }, // Indigo
  V: { bg: '#7C3AED', border: '#4C1D95' }, // Violet (Vishnu)
  W: { bg: '#059669', border: '#064E3B' }, // Emerald
  X: { bg: '#EA580C', border: '#7C2D12' }, // Orange
  Y: { bg: '#DB2777', border: '#831843' }, // Pink
  Z: { bg: '#475569', border: '#0F172A' }, // Slate
};

export function getAvatarColor(name: string): { bg: string; border: string } {
  const clean = (name || '').trim().toUpperCase();
  const firstChar = clean ? clean[0] : 'M';
  if (LETTER_COLORS[firstChar]) {
    return LETTER_COLORS[firstChar];
  }
  return { bg: '#4A7BB0', border: '#1E293B' };
}

export function Avatar({
  src,
  alt,
  size = 'md',
  className = '',
}: {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}) {
  const sz =
    size === 'xs'
      ? 'h-7 w-7 text-xs'
      : size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
      ? 'h-12 w-12 text-lg'
      : size === 'xl'
      ? 'h-14 w-14 text-2xl'
      : size === '2xl'
      ? 'h-20 w-20 text-3xl'
      : 'h-10 w-10 text-base';

  const cleanAlt = (alt || '').trim();
  const initial = cleanAlt ? cleanAlt[0].toUpperCase() : 'M';
  const isDefaultStockPhoto = src
    ? src.includes('220453') ||
      src.includes('pexels-photo-220453') ||
      src.includes('pexels-photo-774909') ||
      src.includes('avatar-placeholder')
    : false;

  const [imgError, setImgError] = useState(false);

  if (src && src.trim() && !isDefaultStockPhoto && !imgError) {
    return (
      <img
        src={src}
        alt={cleanAlt}
        onError={() => setImgError(true)}
        className={`${sz} rounded-full object-cover shadow-sm border border-slate-200/80 shrink-0 ${className}`}
      />
    );
  }

  const colorInfo = getAvatarColor(cleanAlt);
  return (
    <div
      style={{
        backgroundColor: colorInfo.bg,
        borderColor: colorInfo.border,
        color: '#FFFFFF',
      }}
      className={`${sz} flex shrink-0 items-center justify-center rounded-full border-2 shadow-sm font-serif font-bold text-white select-none leading-none ${className}`}
      title={cleanAlt}
    >
      <span className="flex items-center justify-center leading-none select-none">{initial}</span>
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  onLabel = 'ON',
  offLabel = 'OFF',
  ariaLabel = 'Toggle switch',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-24 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2 ${
        checked ? 'bg-emerald-600' : 'bg-gray-400'
      }`}
    >
      <span
        className={`flex h-6 w-6 transform items-center justify-center rounded-full bg-white text-[10px] font-black shadow-md transition duration-200 ease-in-out ${
          checked ? 'translate-x-[4rem] text-emerald-700' : 'translate-x-0 text-gray-600'
        }`}
      >
        {checked ? '✓' : '✕'}
      </span>
      <span
        className={`absolute text-[11px] font-black uppercase tracking-wider select-none ${
          checked ? 'left-3 text-white' : 'right-3 text-navy-950'
        }`}
      >
        {checked ? onLabel : offLabel}
      </span>
    </button>
  );
}

export function Logo({ size = 'md', variant = 'dark' }: { size?: 'sm' | 'md' | 'lg'; variant?: 'light' | 'dark' }) {
  const txt = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';
  const box = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${box} flex items-center justify-center rounded-lg bg-navy-600`}>
        <svg className="h-1/2 w-1/2 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9.75 6.75L18.75 3.75L18.75 14.25M9.75 17L18.75 14.25M9.75 17L5.25 18.75L5.25 8.25L9.75 6.75" />
        </svg>
      </div>
      <span className={`${txt} font-bold tracking-tight ${variant === 'light' ? 'text-white' : 'text-navy-700'}`}>SmartBuild</span>
    </div>
  );
}
