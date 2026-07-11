import { create } from 'zustand';
import { applyBrand } from '../lib/brand';
import { api } from '../services/api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY ?? '';

interface ConfigState {
  settings: Record<string, string>;
  branding: {
    primaryColor: string; accentColor: string; logoUrl: string | null;
    appNamePassenger: string; appNameDriver: string;
  } | null;
  configLoaded: boolean;
  countryBundle: { code: string; currency: string; currencySymbol: string | null; currencyDecimals: number } | null;
  loadConfig: () => Promise<void>;
  getBranding: () => ConfigState['branding'];
  fetchCountryBundle: (token: string) => Promise<void>;
  getSetting: (key: string, defaultValue?: string) => string;
  isFeatureEnabled: (key: string) => boolean;
}

export const useDriverConfigStore = create<ConfigState>((set, get) => ({
  branding: null,
  getBranding: () => get().branding,
  settings: {},
  configLoaded: false,
  countryBundle: null,

  loadConfig: async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (APP_KEY) headers['X-App-Key'] = APP_KEY;

      const res = await fetch(`${API_BASE_URL}/config`, { headers });
      if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);

      const data = await res.json();

      if (data?.branding) {
        set({ branding: data.branding });
        applyBrand(data.branding.primaryColor, data.branding.accentColor);
      }
      set({ settings: data.settings ?? {}, configLoaded: true });
    } catch (e) {
      console.warn('[driverConfigStore] loadConfig failed:', e);
      set({ configLoaded: true });
    }
  },

  fetchCountryBundle: async (token: string) => {
    try {
      const res = await api.getConfigBundle(token);
      set((s) => ({ settings: { ...s.settings, ...res.settings }, countryBundle: res.country ?? null }));
    } catch { /* garder la config globale */ }
  },

  getSetting: (key: string, defaultValue = '') => {
    return get().settings[key] ?? defaultValue;
  },

  isFeatureEnabled: (key: string) => {
    const val = get().settings[key];
    return val === undefined ? true : val !== 'false';
  },
}));

/** Hook : symbole de devise actif (réactif au bundle pays). Fallback 'FCFA'. */
export const useCurrencySymbol = (): string =>
  useDriverConfigStore((s) => s.countryBundle?.currencySymbol || 'FCFA');

/** Hook : nb de décimales de la devise active. Fallback 0. */
export const useCurrencyDecimals = (): number =>
  useDriverConfigStore((s) => s.countryBundle?.currencyDecimals ?? 0);
