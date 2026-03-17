const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// DEV mock mode: set to true to bypass API entirely (OTP fixe: 123456)
const DEV_MOCK_MODE = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
const DEV_FIXED_OTP = '123456';

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

      if (!response.ok) {
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

  // ===== Auth endpoints (shared) =====

  async sendOtp(phone: string) {
    try {
      return await this.request<{ message: string; expiresIn: number }>(
        '/auth/otp/send',
        { method: 'POST', body: { phone } },
      );
    } catch {
      if (DEV_MOCK_MODE) {
        console.log(`[MOCK] OTP envoye a ${phone}: ${DEV_FIXED_OTP}`);
        return { message: 'OTP envoye (mode dev)', expiresIn: 300 };
      }
      throw new ApiError("Echec de l'envoi du code", 500);
    }
  }

  async verifyOtp(phone: string, code: string, defaultRole: string = 'passenger') {
    try {
      return await this.request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; phone: string; name: string | null; role: string };
        isNewUser: boolean;
      }>('/auth/otp/verify', { method: 'POST', body: { phone, code, intendedRole: defaultRole } });
    } catch {
      if (DEV_MOCK_MODE) {
        if (code !== DEV_FIXED_OTP) {
          throw new ApiError('Code OTP incorrect (dev: utilisez 123456)', 401);
        }
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
    data: { name?: string; email?: string },
  ) {
    try {
      return await this.request<{
        id: string;
        phone: string;
        name: string | null;
        email: string | null;
        role: string;
        avatarUrl: string | null;
      }>('/users/me', { method: 'PATCH', body: data, token });
    } catch {
      if (DEV_MOCK_MODE) {
        console.log('[MOCK] updateProfile', data);
        const role = token?.includes('driver') ? 'driver' : 'passenger';
        return {
          id: `dev-${role}-001`,
          phone: '+237690000001',
          name: data.name || null,
          email: data.email || null,
          role,
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
        const role = token?.includes('driver') ? 'driver' : 'passenger';
        return {
          id: `dev-${role}-001`,
          phone: '+237690000001',
          name: 'Utilisateur Dev',
          email: null,
          role,
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
