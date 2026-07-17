import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Durée de validité d'une session biométrique : 12h
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

interface BiometricState {
  enabled: boolean;
  lastAuthAt: number | null;
  _hasHydrated: boolean;
  setEnabled: (enabled: boolean) => void;
  markAuthenticated: () => void;
  requiresAuth: () => boolean;
  setHasHydrated: (v: boolean) => void;
}

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set, get) => ({
      enabled: false,
      lastAuthAt: null,
      _hasHydrated: false,

      setEnabled: (enabled) => set({ enabled }),

      markAuthenticated: () => set({ lastAuthAt: Date.now() }),

      requiresAuth: () => {
        const { enabled, lastAuthAt } = get();
        if (!enabled) return false;
        if (!lastAuthAt) return true;
        return Date.now() - lastAuthAt > SESSION_DURATION_MS;
      },

      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'aerogo24_biometric',
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ enabled: s.enabled, lastAuthAt: s.lastAuthAt }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
