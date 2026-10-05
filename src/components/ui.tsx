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

export function Avatar({ src, alt, size = 'md' }: { src?: string; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  if (src && src.trim()) {
    return <img src={src} alt={alt} className={`${sz} rounded-full object-cover shadow-xs`} />;
  }
  const cleanAlt = (alt || '').trim();
  const initial = cleanAlt ? cleanAlt[0].toUpperCase() : 'U';
  return (
    <div className={`${sz} flex shrink-0 items-center justify-center rounded-full bg-navy-600 text-sm font-bold text-white shadow-xs`}>
      {initial}
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
