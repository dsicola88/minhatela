import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchPublicAppConfig } from '../services/admin';
import { brand } from '../theme/tokens';

const AppConfigContext = createContext(null);

export const BRANDING_DEFAULTS = {
  appName: brand.name,
  tagline: brand.tagline,
  billboardKicker: 'Original MinhaTela · Angola',
  playLabel: 'Assistir',
  moreInfoLabel: 'Mais informações',
  homeAnnouncement: '',
  emptyCatalog: 'Ainda não há conteúdos nesta secção.',
  emptySubtitle: 'Volte em breve para novos lançamentos angolanos.',
  maintenanceMessage: 'MinhaTela em manutenção. Voltamos em breve.',
};

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState({});

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPublicAppConfig();
      setConfig(data?.config || {});
    } catch {
      /* mantém o último snapshot conhecido */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const branding = useMemo(
    () => ({ ...BRANDING_DEFAULTS, ...(config.branding || {}) }),
    [config.branding]
  );

  const value = useMemo(
    () => ({
      config,
      branding,
      landing: config.landing || {},
      support: config.support || {},
      onboarding: config.onboarding || {},
      payments: config.payments || {},
      refresh,
    }),
    [config, branding, refresh]
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    return {
      config: {},
      branding: BRANDING_DEFAULTS,
      landing: {},
      support: {},
      onboarding: {},
      payments: {},
      refresh: async () => {},
    };
  }
  return ctx;
}

export function useBrandCopy() {
  const { branding } = useAppConfig();
  return branding;
}
