import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dictionaries } from './dictionaries';

const LANG_KEY = 'minhatela.lang';
const LanguageContext = createContext(null);

export function LanguageProvider({ children, defaultLocale = 'pt' }) {
  const [locale, setLocaleState] = useState(defaultLocale);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((stored) => {
      if (stored && dictionaries[stored]) setLocaleState(stored);
    });
  }, []);

  const setLocale = useCallback(async (next) => {
    if (!dictionaries[next]) return;
    setLocaleState(next);
    await AsyncStorage.setItem(LANG_KEY, next);
  }, []);

  const t = useCallback(
    (key, fallback) => {
      const dict = dictionaries[locale] || dictionaries.pt;
      return dict[key] || dictionaries.pt[key] || fallback || key;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      available: [
        { code: 'pt', label: 'Português' },
        { code: 'en', label: 'English' },
      ],
    }),
    [locale, setLocale, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useI18n must be used within LanguageProvider');
  }
  return ctx;
}

/** Compatibilidade com imports antigos `t` estático — preferir useI18n(). */
export function t(key) {
  return dictionaries.pt[key] || key;
}
