const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
export const DEFAULT_ROLE = 'driver';

// Origine de l'API (sans /api) — pour résoudre les médias en chemin relatif (images d'annonces)
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

// S352 — Callback déclenché sur 401 (JWT expiré) → logout + redirect login
let _onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(cb: () => void) {
  _onUnauthorized = cb;
}

let _getRefreshToken: (() => string | null) | null = null;
let _onTokenRefreshed: ((accessToken: string, refreshToken: string) => void) | null = null;
export function registerTokenRefreshHandlers(
  getRefreshToken: () => string | null,
  onTokenRefreshed: (accessToken: string, refreshToken: string) => void,
) {
  _getRefreshToken = getRefreshToken;
  _onTokenRefreshed = onTokenRefreshed;
}

let _refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

// DEV mock mode: disabled when EXPO_PUBLIC_API_URL is set (real backend)
export const DEV_MOCK_MODE = !process.env.EXPO_PUBLIC_API_URL && (typeof __DEV__ !== 'undefined' ? __DEV__ : true);

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export class ApiClient {
  protected baseUrl: string;
  protected mockMode = false;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    if (DEV_MOCK_MODE) {
      this.checkApiAvailability();
    }
  }

  private async checkApiAvailability() {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 2000);
      await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      this.mockMode = false;
    } catch {
      console.log('[DEV] API non disponible - mode mock active (OTP: 123456)');
      this.mockMode = true;
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, token } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (response.status === 401 && token && _getRefreshToken && _onTokenRefreshed) {
        try {
          const refreshed = await this.doRefreshToken();
          if (refreshed) {
            const retryHeaders = { ...headers, Authorization: `Bearer ${refreshed.accessToken}` };
            const retryRes = await fetch(`${this.baseUrl}${endpoint}`, {
              method,
              headers: retryHeaders,
              body: body ? JSON.stringify(body) : undefined,
            });
            const retryData = await retryRes.json();
            if (retryRes.ok) return retryData as T;
          }
        } catch {
          // refresh failed, fall through to logout
        }
        if (_onUnauthorized) _onUnauthorized();
        throw new ApiError(data.message || 'Session expirée', 401, data);
      }

      if (!response.ok) {
        if (response.status === 401 && token && _onUnauthorized) {
          _onUnauthorized();
        }
        throw new ApiError(
          data.message || 'Une erreur est survenue',
          response.status,
          data,
        );
      }

      return data as T;
    } catch (err) {
      if (this.mockMode || DEV_MOCK_MODE) {
        throw err;
      }
      throw err;
    }
  }

  private async doRefreshToken(): Promise<{ accessToken: string; refreshToken: string } | null> {
    if (_refreshPromise) return _refreshPromise;
    const rt = _getRefreshToken?.();
    if (!rt) return null;
    _refreshPromise = this.refreshToken(rt);
    try {
      const result = await _refreshPromise;
      _onTokenRefreshed?.(result.accessToken, result.refreshToken);
      return result;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  }

  // ===== Auth endpoints (shared) =====

  async getOtpChannels(identifier: string) {
    return this.request<{ channels: ('sms' | 'whatsapp' | 'email')[]; default: string }>(
      '/auth/otp/channels',
      { method: 'POST', body: { identifier } },
    );
  }

  async sendOtp(phone: string, channel?: 'sms' | 'whatsapp' | 'email') {
    try {
      return await this.request<{ message: string; expiresIn: number }>(
        '/auth/otp/send',
        { method: 'POST', body: { phone, ...(channel ? { channel } : {}) } },
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (DEV_MOCK_MODE) {
        console.log(`[MOCK] OTP envoye a ${phone} (code dans les logs backend)`);
        return { message: 'OTP envoye (mode dev)', expiresIn: 300 };
      }
      throw new ApiError("Echec de l'envoi du code", 500);
    }
  }

  async linkPhoneSend(token: string, phone: string, channel: 'sms' | 'whatsapp') {
    return this.request<{ message: string; expiresIn: number }>(
      '/auth/phone/link/send',
      { method: 'POST', body: { phone, channel }, token },
    );
  }

  async linkPhoneVerify(token: string, phone: string, code: string) {
    return this.request<{ id: string; phone: string; countryCode: string | null; profileComplete: boolean }>(
      '/auth/phone/link/verify',
      { method: 'POST', body: { phone, code }, token },
    );
  }

  async verifyOtp(phone: string, code: string, defaultRole: string = DEFAULT_ROLE) {
    try {
      return await this.request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; phone: string; name: string | null; role: string };
        isNewUser: boolean;
      }>('/auth/otp/verify', { method: 'POST', body: { phone, code, intendedRole: defaultRole } });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log(`[MOCK] OTP verifie pour ${phone}`);
        const mockUser = {
          id: `dev-${defaultRole}-001`,
          phone,
          name: null,
          role: defaultRole,
        };
        return {
          accessToken: `dev-mock-${defaultRole}-access-token`,
          refreshToken: `dev-mock-${defaultRole}-refresh-token`,
          user: mockUser,
          isNewUser: true,
        };
      }
      throw new ApiError('Code invalide', 401);
    }
  }

  async googleLogin(code: string, codeVerifier: string, redirectUri: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; phone: string | null; name: string | null; role: string };
      isNewUser: boolean;
    }>('/auth/google', { method: 'POST', body: { code, codeVerifier, redirectUri } });
  }

  async refreshToken(refreshToken: string) {
    return this.request<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { method: 'POST', body: { refreshToken } },
    );
  }

  async getMe(token: string) {
    return this.request<{
      id: string;
      phone: string;
      name: string | null;
      email: string | null;
      role: string;
      avatarUrl: string | null;
    }>('/auth/me', { token });
  }

  // ===== Users endpoints (shared) =====

  async updateProfile(
    token: string,
    data: any,
  ) {
    try {
      return await this.request<any>('/users/me', { method: 'PATCH', body: data, token });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log('[MOCK] updateProfile', data);
        return {
          id: `dev-passenger-001`,
          phone: '+237690000001',
          name: data.name || null,
          email: data.email || null,
          role: 'passenger',
          avatarUrl: null,
        };
      }
      throw new ApiError('Echec mise a jour profil', 500);
    }
  }

  async getProfile(token: string) {
    try {
      return await this.request<{
        id: string;
        phone: string;
        name: string | null;
        email: string | null;
        role: string;
        avatarUrl: string | null;
        language: string;
      }>('/users/me', { token });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log('[MOCK] getProfile');
        return {
          id: `dev-passenger-001`,
          phone: '+237690000001',
          name: 'Utilisateur Dev',
          email: null,
          role: 'passenger',
          avatarUrl: null,
          language: 'fr',
        };
      }
      throw new ApiError('Echec chargement profil', 500);
    }
  }

  // ===== Chat / Conversations endpoints (shared) =====

  async getConversations(token: string) {
    try {
      return await this.request<unknown[]>('/chat/conversations', { token });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log('[MOCK] getConversations');
        return [];
      }
      throw new ApiError('Erreur chargement conversations', 500);
    }
  }

  async getChatMessages(token: string, conversationId: string) {
    try {
      return await this.request<unknown[]>(`/chat/conversations/${conversationId}/messages`, { token });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log(`[MOCK] getChatMessages ${conversationId}`);
        return [];
      }
      throw new ApiError('Erreur chargement messages', 500);
    }
  }

  async sendChatMessage(token: string, conversationId: string, content: string) {
    try {
      return await this.request<unknown>(`/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { content },
        token,
      });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log(`[MOCK] sendChatMessage to ${conversationId}`);
        return {
          id: `mock-msg-${Date.now()}`,
          content,
          senderId: 'dev-user-001',
          readAt: null,
          createdAt: new Date().toISOString(),
        };
      }
      throw new ApiError("Erreur envoi message", 500);
    }
  }

  async markChatRead(token: string, conversationId: string) {
    try {
      return await this.request<{ success: boolean }>(`/chat/conversations/${conversationId}/read`, {
        method: 'POST',
        token,
      });
    } catch {
      if (DEV_MOCK_MODE) {
        return { success: true };
      }
      throw new ApiError('Erreur marquage lu', 500);
    }
  }

  async startConversation(token: string, driverId: string, flightId?: string) {
    try {
      return await this.request<{ id: string }>('/chat/conversations', {
        method: 'POST',
        body: { driverId, flightId },
        token,
      });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log(`[MOCK] startConversation with driver ${driverId}`);
        return { id: `mock-conv-${Date.now()}` };
      }
      throw new ApiError('Erreur creation conversation', 500);
    }
  }

  // ===== Rating endpoints (shared) =====

  async submitRating(token: string, data: { toUserId: string; conversationId: string; score: number; comment?: string }) {
    try {
      return await this.request<{ id: string; score: number; comment: string | null }>('/ratings', {
        method: 'POST',
        body: data,
        token,
      });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log(`[MOCK] submitRating for ${data.toUserId}`);
        return { id: `mock-rating-${Date.now()}`, score: data.score, comment: data.comment || null };
      }
      throw new ApiError('Erreur envoi evaluation', 500);
    }
  }

  async savePushToken(token: string, pushToken: string) {
    try {
      return await this.request<{ success: boolean }>('/notifications/token', {
        method: 'POST',
        body: { token: pushToken },
        token,
      });
    } catch {
      // non critique, ignorer
    }
  }

  async getDriverRatings(token: string, driverId: string) {
    try {
      return await this.request<{
        ratings: { id: string; score: number; comment: string | null; createdAt: string; fromUser: { name: string | null } }[];
        average: number;
        count: number;
      }>(`/ratings/driver/${driverId}`, { token });
    } catch {
      if (DEV_MOCK_MODE) {
        return { ratings: [], average: 0, count: 0 };
      }
      throw new ApiError('Erreur chargement avis', 500);
    }
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export { API_BASE_URL };
