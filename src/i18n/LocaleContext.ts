import { createContext, useContext } from 'react';
import type { Locale } from './index';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}
