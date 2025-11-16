import type { AIConfig } from './aiConfig';

export const PROVIDER_CONFIG_STORAGE_KEY = 'infinitynotex:ai:provider-configs';

export const readStoredProviderConfigs = (): Record<string, AIConfig> => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PROVIDER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, AIConfig>;
  } catch (error) {
    console.warn('[AI] Failed to parse cached provider configs:', error);
    return {};
  }
};

export const persistProviderConfigs = (configs: Record<string, AIConfig>) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(PROVIDER_CONFIG_STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.warn('[AI] Failed to persist provider configs:', error);
  }
};
