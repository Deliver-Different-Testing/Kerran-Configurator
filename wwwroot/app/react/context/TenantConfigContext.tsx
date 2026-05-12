import React, { createContext, useContext, useState, useCallback } from 'react';

export interface TenantConfig {
  directCouriersEnabled: boolean;
  agentsEnabled: boolean;
  networkPartnersEnabled: boolean;
  courierRecruitmentEnabled: boolean;
  schedulingEnabled: boolean;
  quotesEnabled: boolean;
}

const DEFAULT_CONFIG: TenantConfig = {
  directCouriersEnabled: false,
  agentsEnabled: true,
  networkPartnersEnabled: true,
  courierRecruitmentEnabled: false,
  schedulingEnabled: false,
  quotesEnabled: true,
};

const STORAGE_KEY = 'dfrnt_tenant_config';

interface TenantConfigContextValue {
  config: TenantConfig;
  updateConfig: (partial: Partial<TenantConfig>) => void;
  resetConfig: () => void;
}

const TenantConfigContext = createContext<TenantConfigContextValue>({
  config: DEFAULT_CONFIG,
  updateConfig: () => {},
  resetConfig: () => {},
});

export function TenantConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TenantConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch { /* ignore */ }
    return DEFAULT_CONFIG;
  });

  const updateConfig = useCallback((partial: Partial<TenantConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(DEFAULT_CONFIG);
  }, []);

  return (
    <TenantConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </TenantConfigContext.Provider>
  );
}

export function useTenantConfig() {
  return useContext(TenantConfigContext);
}
