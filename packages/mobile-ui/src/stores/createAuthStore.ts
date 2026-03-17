import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@aerocab/shared';

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  _hasHydrated: boolean;
  setAuth: (user: User, token: string, refreshToken: string, isNewUser: boolean) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export function createAuthStore(storageKey: string) {
  return create<AuthState>()(
    persist(
      (set) => ({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isNewUser: false,
        _hasHydrated: false,

        setAuth: (user, token, refreshToken, isNewUser) =>
          set({ user, token, refreshToken, isAuthenticated: true, isNewUser }),

        setUser: (user) => set({ user }),

        logout: () =>
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isNewUser: false,
          }),

        setHasHydrated: (state) => set({ _hasHydrated: state }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);
        },
      },
    ),
  );
}
