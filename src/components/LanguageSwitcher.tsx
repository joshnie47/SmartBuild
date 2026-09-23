import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import { LOCALES, LOCALE_LABELS, type Locale } from '../i18n';

interface LanguageSwitcherProps {
  variant?: 'header' | 'minimal' | 'sidebar' | 'card';
  className?: string;
}

export function LanguageSwitcher({ variant = 'header', className = '' }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (l: Locale) => {
    setLocale(l);
    setIsOpen(false);
  };

  const getLanguageDisplayName = (l: Locale) => {
    switch (l) {
      case 'en':
        return 'English';
      case 'ta':
        return 'தமிழ்';
      default:
        return LOCALE_LABELS[l];
    }
  };

  const getFlagEmoji = (l: Locale) => {
    return l === 'en' ? '🇬🇧' : '🇮🇳';
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-300 hover:bg-navy-800 hover:text-white transition-colors"
          title="Change Language / மொழியை மாற்றுக"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-amber-400" />
            <span>🌐 {getLanguageDisplayName(locale)}</span>
          </div>
          <span className="text-[10px] font-bold text-amber-400 uppercase bg-amber-400/10 px-1.5 py-0.5 rounded">
            {locale.toUpperCase()}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50 hover:border-gray-300 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          title="Change Language / மொழியை மாற்றுக"
          aria-label="Select Language"
        >
          <Globe className="h-4 w-4 text-navy-600" strokeWidth={1.8} />
          <span className="hidden sm:inline-block font-medium">Language:</span>
          <span className="font-bold text-amber-600">{getLanguageDisplayName(locale)}</span>
        </button>
      )}

      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-44 rounded-xl border border-gray-100 bg-white p-1.5 shadow-card ring-1 ring-black/5 animate-fadeIn ${
            variant === 'sidebar' ? 'bottom-full mb-2 left-0' : 'right-0'
          }`}
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 mb-1">
            🌐 Select Language
          </div>
          <div className="space-y-0.5">
            {LOCALES.map((loc) => {
              const isActive = locale === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleSelect(loc)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-50 text-amber-900 font-bold'
                      : 'text-navy-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{getFlagEmoji(loc)}</span>
                    <span>{getLanguageDisplayName(loc)}</span>
                  </div>
                  {isActive && <Check className="h-3.5 w-3.5 text-amber-600 stroke-[2.5]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
