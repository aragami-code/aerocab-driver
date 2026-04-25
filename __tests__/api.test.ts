/**
 * Tests for the driver API client (services/api.ts + lib/api-base.ts)
 *
 * DEV_MOCK_MODE must be disabled (set EXPO_PUBLIC_API_URL) so that the real
 * request path is exercised and fetch calls are actually made.
 */

// Must be set before importing to disable mock mode
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/api';

// Mock react-native before any imports
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

import { driverApi, ApiError } from '../services/api';

// Helper to mock fetch with a successful JSON response
function mockFetchOk(body: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as any;
}

function mockFetchError(body: unknown, status = 400) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as any;
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ── toggleAvailability ────────────────────────────────────────────────────────

describe('driverApi.toggleAvailability', () => {
  it('calls PATCH /drivers/availability with isAvailable=true', async () => {
    mockFetchOk({ isAvailable: true });

    const result = await driverApi.toggleAvailability('drv-token-abc', true);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/drivers/availability');
    expect(opts.method).toBe('PATCH');
    const body = JSON.parse(opts.body);
    expect(body.isAvailable).toBe(true);
    expect(opts.headers['Authorization']).toBe('Bearer drv-token-abc');
    expect(result.isAvailable).toBe(true);
  });

  it('calls PATCH /drivers/availability with isAvailable=false', async () => {
    mockFetchOk({ isAvailable: false });

    const result = await driverApi.toggleAvailability('drv-token-abc', false);

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(opts.body).isAvailable).toBe(false);
    expect(result.isAvailable).toBe(false);
  });
});

// ── requestWithdrawal ─────────────────────────────────────────────────────────

describe('driverApi.requestWithdrawal', () => {
  it('calls POST /drivers/withdraw with amount, method and mobileNumber', async () => {
    mockFetchOk({ id: 'wd-001', status: 'pending', amount: 10000 });

    const result = await driverApi.requestWithdrawal(
      'drv-token-abc',
      10000,
      'mtn_momo',
      '+237670000001',
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/drivers/withdraw');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.amount).toBe(10000);
    expect(body.method).toBe('mtn_momo');
    expect(body.mobileNumber).toBe('+237670000001');
    expect(result.id).toBe('wd-001');
    expect(result.status).toBe('pending');
  });

  it('throws ApiError on insufficient balance (400)', async () => {
    mockFetchError({ message: 'Solde insuffisant' }, 400);

    await expect(
      driverApi.requestWithdrawal('drv-token-abc', 999999, 'orange_money', '+237690000001'),
    ).rejects.toThrow(ApiError);
  });
});

// ── sendOtp (inherited from ApiClient base) ───────────────────────────────────

describe('driverApi.sendOtp', () => {
  it('calls POST /auth/otp/send with the driver phone number', async () => {
    mockFetchOk({ message: 'OTP sent', expiresIn: 300 });

    const result = await driverApi.sendOtp('+237690000001');

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/auth/otp/send');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ phone: '+237690000001' });
    expect(result.message).toBe('OTP sent');
  });
});

// ── verifyOtp (inherited from ApiClient base) ─────────────────────────────────

describe('driverApi.verifyOtp', () => {
  it('calls POST /auth/otp/verify and returns accessToken + user', async () => {
    const mockResponse = {
      accessToken: 'drv-access-token',
      refreshToken: 'drv-refresh-token',
      user: { id: 'drv-u-001', phone: '+237690000001', name: 'Paul Mbeki', role: 'driver' },
      isNewUser: false,
    };
    mockFetchOk(mockResponse);

    const result = await driverApi.verifyOtp('+237690000001', '654321', 'driver');

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/auth/otp/verify');
    const body = JSON.parse(opts.body);
    expect(body.phone).toBe('+237690000001');
    expect(body.code).toBe('654321');
    expect(body.intendedRole).toBe('driver');
    expect(result.accessToken).toBe('drv-access-token');
    expect(result.user.role).toBe('driver');
  });
});

// ── ApiError ──────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('is an instance of Error with statusCode', () => {
    const err = new ApiError('Unauthorized', 401);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });
});
