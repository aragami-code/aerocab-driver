/**
 * Tests for the driver authStore (Zustand + persist + expo-secure-store)
 * lib/auth-store.ts + stores/authStore.ts
 */

// Mock react-native before any imports
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

import { createAuthStore } from '../lib/auth-store';
import type { User } from '../lib/shared';

const MOCK_DRIVER_USER: User = {
  id: 'drv-user-001',
  phone: '+237600000099',
  name: 'Paul Mbeki',
  email: null,
  avatarUrl: null,
  role: 'driver',
  status: 'active',
  language: 'fr',
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

// Create a fresh store for each test (unique key avoids cross-test pollution)
let store: ReturnType<typeof createAuthStore>;

beforeEach(() => {
  store = createAuthStore(`test-driver-auth-${Date.now()}`);
});

describe('authStore (driver) — initial state', () => {
  it('starts unauthenticated with null token and user', () => {
    const state = store.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isNewUser).toBe(false);
  });
});

describe('authStore (driver) — setAuth', () => {
  it('sets token, refreshToken, user and marks authenticated', () => {
    store.getState().setAuth(MOCK_DRIVER_USER, 'drv-access-token', 'drv-refresh-token', false);

    const state = store.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('drv-access-token');
    expect(state.refreshToken).toBe('drv-refresh-token');
    expect(state.user).toEqual(MOCK_DRIVER_USER);
    expect(state.isNewUser).toBe(false);
  });

  it('marks isNewUser when the driver just registered', () => {
    store.getState().setAuth(MOCK_DRIVER_USER, 'tok', 'ref', true);
    expect(store.getState().isNewUser).toBe(true);
  });
});

describe('authStore (driver) — setUser', () => {
  it('updates user fields without clearing the token', () => {
    store.getState().setAuth(MOCK_DRIVER_USER, 'drv-access-token', 'drv-refresh-token', false);

    const updated: User = { ...MOCK_DRIVER_USER, name: 'Paul Mbeki Updated' };
    store.getState().setUser(updated);

    const state = store.getState();
    expect(state.user?.name).toBe('Paul Mbeki Updated');
    expect(state.token).toBe('drv-access-token');
    expect(state.isAuthenticated).toBe(true);
  });
});

describe('authStore (driver) — logout', () => {
  it('clears all auth state', () => {
    store.getState().setAuth(MOCK_DRIVER_USER, 'drv-access-token', 'drv-refresh-token', false);
    store.getState().logout();

    const state = store.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isNewUser).toBe(false);
  });
});

describe('authStore (driver) — setHasHydrated', () => {
  it('flips the hydration flag', () => {
    store.getState().setHasHydrated(false); // reset to known state first
    expect(store.getState()._hasHydrated).toBe(false);
    store.getState().setHasHydrated(true);
    expect(store.getState()._hasHydrated).toBe(true);
  });
});
