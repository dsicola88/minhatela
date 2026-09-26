/** Tema original (cinema / Netflix AO) */
export const darkTheme = Object.freeze({
  id: 'dark',
  label: 'Original',
  labelEn: 'Original',
  statusBar: 'light',
  black: '#000000',
  red: '#CE1126',
  redDark: '#9B0C1C',
  redBright: '#E50914',
  gold: '#F7D417',
  goldMuted: '#C9A912',
  surface: '#111111',
  surfaceSecondary: '#181818',
  elevated: '#141414',
  border: '#2A2A2A',
  muted: '#A3A3A3',
  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  overlay: 'rgba(0,0,0,0.65)',
  success: '#22C55E',
  warning: '#F7D417',
  danger: '#CE1126',
  /** aliases semânticos */
  background: '#000000',
  card: '#111111',
  navbar: 'rgba(0,0,0,0.92)',
});

/**
 * Tema claro — mesma identidade Angola (vermelho/amarelo),
 * base branca/cinza para leitura diurna e dados móveis.
 */
export const lightTheme = Object.freeze({
  id: 'light',
  label: 'Claro',
  labelEn: 'Light',
  statusBar: 'dark',
  black: '#F4F4F5',
  red: '#CE1126',
  redDark: '#9B0C1C',
  redBright: '#E50914',
  gold: '#C9A00A',
  goldMuted: '#A6860A',
  surface: '#FFFFFF',
  surfaceSecondary: '#F0F0F2',
  elevated: '#FFFFFF',
  border: '#D4D4D8',
  muted: '#71717A',
  text: '#18181B',
  textSecondary: '#3F3F46',
  overlay: 'rgba(244,244,245,0.82)',
  success: '#16A34A',
  warning: '#CA8A04',
  danger: '#CE1126',
  background: '#F4F4F5',
  card: '#FFFFFF',
  navbar: 'rgba(255,255,255,0.94)',
});

export const themes = Object.freeze({
  dark: darkTheme,
  light: lightTheme,
});

/** Objecto mutável lido em runtime — ThemeProvider faz Object.assign */
export const colors = { ...darkTheme };

export function applyTheme(themeId) {
  const next = themes[themeId] || darkTheme;
  Object.assign(colors, next);
  return next;
}

export function getThemeId() {
  return colors.id || 'dark';
}

export const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
});

export const typography = Object.freeze({
  brand: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export const layout = Object.freeze({
  maxContentWidth: 1400,
  navbarHeight: 68,
  billboardHeightRatio: 0.75,
  cardAspectRatio: 16 / 9,
  profileSize: 112,
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
});

export const brand = Object.freeze({
  name: 'MinhaTela',
  tagline: 'Cinema e séries de Angola, no ecrã certo.',
  market: 'AO',
  currency: 'Kz',
});
