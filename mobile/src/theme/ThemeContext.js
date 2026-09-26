import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { applyTheme, colors as palette, themes } from './tokens';
import { getThemePreference, setThemePreference } from '../platform/preferences';

const ThemeContext = createContext(null);

export function ThemeProvider({ children, defaultTheme = 'dark' }) {
  const [themeId, setThemeIdState] = useState(defaultTheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    getThemePreference().then((stored) => {
      if (!alive) return;
      const id = themes[stored] ? stored : defaultTheme;
      applyTheme(id);
      setThemeIdState(id);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [defaultTheme]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themeId);
    }
  }, [themeId]);

  const setTheme = useCallback(async (next) => {
    if (!themes[next]) return;
    applyTheme(next);
    setThemeIdState(next);
    await setThemePreference(next);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = themeId === 'light' ? 'dark' : 'light';
    await setTheme(next);
  }, [setTheme, themeId]);

  const value = useMemo(
    () => ({
      ready,
      themeId,
      theme: themes[themeId] || themes.dark,
      colors: palette,
      isLight: themeId === 'light',
      isDark: themeId === 'dark',
      setTheme,
      toggleTheme,
      available: [
        { id: 'dark', label: 'Original', description: 'Cinema · fundo preto' },
        { id: 'light', label: 'Claro', description: 'Leitura diurna · fundo claro' },
      ],
      statusBarStyle: themeId === 'light' ? 'dark' : 'light',
    }),
    [ready, themeId, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      ready: true,
      themeId: 'dark',
      theme: themes.dark,
      colors: palette,
      isLight: false,
      isDark: true,
      setTheme: async () => {},
      toggleTheme: async () => {},
      available: [],
      statusBarStyle: 'light',
    };
  }
  return ctx;
}
