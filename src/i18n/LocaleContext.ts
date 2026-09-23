import { createContext, useContext } from 'react';
import { type Locale, type TranslationKey, t as translate } from './index';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t?: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key: TranslationKey, vars?: Record<string, string | number>) => translate('en', key, vars),
});

export function useLocale() {
  const ctx = useContext(LocaleContext);
  return {
    ...ctx,
    t: (key: TranslationKey, vars?: Record<string, string | number>) => translate(ctx.locale, key, vars),
  };
}

