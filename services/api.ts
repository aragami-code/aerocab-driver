import { ApiClient, ApiError } from '../lib/api-base';

const IS_DEV = !process.env.EXPO_PUBLIC_API_URL && (typeof __DEV__ !== 'undefined' ? __DEV__ : true);

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_PROFILE = {
  id: 'drv-mock-001',
  status: 'approved' as const,
  isAvailable: false,
  registrationFeePaid: true,
  vehicleBrand: 'Toyota',
  vehicleModel: 'Corolla',
  vehicleColor: 'Blanc',
  vehiclePlate: 'LT 1234 AB',
  languages: ['fr', 'en'],
  ratingAvg: 4.8,
  ratingCount: 42,
  reputationScore: 850,
  walletBalance: 24500,
  totalRides: 156,
  countryCode: 'CM' as string | null,
  user: { id: 'u-drv-001', name: 'Paul Mbeki', phone: '+237600000000', avatarUrl: null },
};

const MOCK_RIDE: RideRequest = {
  id: 'mock-booking-001',
  passengerId: 'p-001',
  passengerName: 'Alice Nguemo',
  flightNumber: 'AF946',
  destination: 'Bonanjo, Douala',
  vehicleType: 'standard',
  estimatedPrice: 7000,
  departureAirport: 'DLA',
  seats: 5,
  type: 'ARRIVAL' as const,
};

// ── Types ────────────────────────────────────────────────────────────────────
export type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type RideRequest = {
  id: string;
  passengerId: string;
  passengerName: string | null;
  passengerAvatarUrl?: string | null;
  passengerVerified?: boolean;
  passengerTrustScore?: number;
  flightNumber: string | null;
  destination: string;
  vehicleType: string;
  estimatedPrice: number;
  departureAirport: string;
  seats: number;
  type?: 'ARRIVAL' | 'DEPARTURE' | 'INTERNATIONAL';
  pickupAddress?: string;
  distanceKm?: number;
  durationMin?: number;
  // Réservation programmée (INTERNATIONAL à l'avance dispatché par le cron)
  isScheduled?: boolean;
  scheduledAt?: string | null;
  // Forfait
  pricingMode?: 'kilometrage' | 'forfait';
  // Lot 2 — Meet & Greet (pancarte) + badge client fidèle
  meetAndGreet?: boolean;
  isFavoritePassenger?: boolean;
};

export type FlightStatus = {
  airline: string | null;
  scheduledArrival: string;
  actualArrival: string | null;
  status: 'on_time' | 'delayed' | 'landed';
  minutesUntilLanding: number;
};

export type ActiveRide = {
  id: string;
  status: 'confirmed' | 'arrived_at_airport' | 'in_progress' | 'passenger_confirming' | 'completed';
  passengerId: string;
  passengerName: string | null;
  passengerAvatarUrl?: string | null;
  passengerVerified?: boolean;
  flightNumber: string | null;
  flightStatus: FlightStatus | null;
  destination: string;
  vehicleType: string;
  estimatedPrice: number;
  departureAirport: string;
  shareTripEnabled: boolean;
  type: 'ARRIVAL' | 'DEPARTURE' | 'INTERNATIONAL';
  pickupAddress?: string | null;
  pricingMode?: 'kilometrage' | 'forfait';
  distanceKm?: number;
  durationMin?: number;
  passengerPhone?: string | null;
};

export type DriverRide = {
  id: string;
  status: 'completed' | 'cancelled';
  type: 'ARRIVAL' | 'DEPARTURE' | 'INTERNATIONAL';
  departureAirport: string;
  destination: string;
  estimatedPrice: number;
  estimatedDistanceKm: number | null;
  estimatedDurationMin: number | null;
  pricingMode: 'kilometrage' | 'forfait' | 'zone';
  createdAt: string;
  completedAt: string | null;
  passengerName: string | null;
  passengerAvatarUrl: string | null;
};

export type DriverRideDetail = DriverRide & {
  flightNumber: string | null;
  baseFare: number | null;
  airportFee: number | null;
  startedAt: string | null;
};

export type DriverRideReceipt = DriverRideDetail & {
  reference: string;
};

// ── DriverApiClient ───────────────────────────────────────────────────────────
class DriverApiClient extends ApiClient {

  // ── Profil chauffeur ──────────────────────────────────────────────────────

  async registerDriver(token: string, data: {
    vehicleBrand: string;
    vehicleModel: string;
    vehicleColor: string;
    vehiclePlate: string;
    vehicleYear?: string;
    vehicleCategory?: string;
    languages: string[];
    name?: string;
  }) {
    try {
      const body: Record<string, unknown> = {
        vehicleBrand: data.vehicleBrand,
        vehicleModel: data.vehicleModel,
        vehicleColor: data.vehicleColor,
        vehiclePlate: data.vehiclePlate,
        languages: data.languages,
      };
      if (data.name) body.name = data.name;
      if (data.vehicleYear) body.vehicleYear = parseInt(data.vehicleYear, 10);
      if (data.vehicleCategory) body.vehicleCategory = data.vehicleCategory;
      return await this.request<{ id: string; status: string }>(
        '/drivers/register', { method: 'POST', body, token },
      );
    } catch (e) {
      if (IS_DEV) return { id: 'drv-mock', status: 'pending' };
      throw e instanceof ApiError ? e : new ApiError('Erreur enregistrement chauffeur', 500);
    }
  }

  async getMyProfile(token: string) {
    try {
      return await this.request<{
        id: string;
        status: DriverStatus;
        isAvailable: boolean;
        registrationFeePaid: boolean;
        vehicleBrand: string;
        vehicleModel: string;
        vehicleColor: string;
        vehiclePlate: string;
        languages: string[];
        ratingAvg: number;
        ratingCount: number;
        reputationScore: number;
        walletBalance: number;
        totalRides: number;
        countryCode: string | null;
        user: { id: string; name: string | null; phone: string; avatarUrl: string | null };
      }>('/drivers/me', { token });
    } catch (err) {
      if (IS_DEV) return MOCK_PROFILE;
      // Relancer l'erreur avec le statut HTTP pour que loadData puisse distinguer 404 vs autre
      throw err;
    }
  }

  async updateProfile(token: string, data: {
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehiclePlate?: string;
    languages?: string[];
  }) {
    try {
      return await this.request<{ id: string }>(
        '/drivers/me', { method: 'PATCH', body: data, token },
      );
    } catch {
      if (IS_DEV) return { id: MOCK_PROFILE.id };
      throw new ApiError('Erreur mise à jour profil', 500);
    }
  }

  async requestCountryChange(token: string, requestedCountry: string, reason: string) {
    return this.request<{ id: string; status: string; requestedCountry: string }>(
      '/drivers/me/country-change-request',
      { method: 'POST', token, body: { requestedCountry, reason } },
    );
  }

  async getCountryChangeRequest(token: string) {
    return this.request<{ id: string; status: string; requestedCountry: string; currentCountry: string; adminNote: string | null } | null>(
      '/drivers/me/country-change-request', { token },
    );
  }

  async uploadDocument(token: string, data: {
    type: string;
    uri: string;
    mimeType?: string;
    name?: string;
  }) {
    if (IS_DEV) return { id: `doc-mock-${Date.now()}`, type: data.type, status: 'pending' };

    const apiUrl = process.env.EXPO_PUBLIC_API_URL!;
    const formData = new FormData();
    const ext = data.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    formData.append('file', {
      uri: data.uri,
      name: data.name ?? `${data.type}.${ext}`,
      type: data.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
    formData.append('type', data.type);

    const res = await fetch(`${apiUrl}/drivers/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err.message ?? 'Erreur upload document', res.status);
    }
    return res.json() as Promise<{ id: string; type: string; status: string }>;
  }

  async getMyDocuments(token: string) {
    try {
      return await this.request<{
        type: string;
        status: 'pending' | 'approved' | 'rejected';
        rejectionReason: string | null;
        fileUrl: string;
      }[]>('/drivers/documents', { token });
    } catch {
      if (IS_DEV) return [];
      throw new ApiError('Erreur chargement documents', 500);
    }
  }

  async submitForReview(token: string) {
    try {
      return await this.request<{ message: string }>(
        '/drivers/submit-review', { method: 'POST', body: {}, token },
      );
    } catch {
      if (IS_DEV) return { message: 'Soumis pour vérification (mock)' };
      throw new ApiError('Erreur soumission', 500);
    }
  }

  // ── Disponibilité & position ──────────────────────────────────────────────

  async toggleAvailability(token: string, isAvailable: boolean) {
    try {
      return await this.request<{ isAvailable: boolean }>(
        '/drivers/availability', { method: 'PATCH', body: { isAvailable }, token },
      );
    } catch {
      if (IS_DEV) return { isAvailable };
      throw new ApiError('Erreur disponibilité', 500);
    }
  }

  async updateLocation(token: string, latitude: number, longitude: number) {
    try {
      return await this.request<{ ok: boolean }>(
        '/drivers/location', { method: 'PATCH', body: { latitude, longitude }, token },
      );
    } catch {
      if (IS_DEV) return { ok: true };
      // Silencieux — les erreurs de position ne doivent pas bloquer
      return { ok: false };
    }
  }

  // ── Courses ───────────────────────────────────────────────────────────────

  async getPendingRequest(token: string) {
    try {
      return await this.request<{ booking: RideRequest | null }>(
        '/bookings/driver/pending', { token },
      );
    } catch {
      if (IS_DEV) return { booking: null };
      throw new ApiError('Erreur chargement demande', 500);
    }
  }

  async acceptBooking(token: string, bookingId: string) {
    try {
      return await this.request<{ id: string; status: string }>(
        `/bookings/${bookingId}/accept`, { method: 'PATCH', body: {}, token },
      );
    } catch {
      if (IS_DEV) return { id: bookingId, status: 'confirmed' };
      throw new ApiError('Erreur acceptation course', 500);
    }
  }

  async declineBooking(token: string, bookingId: string) {
    try {
      return await this.request<{ id: string; status: string }>(
        `/bookings/${bookingId}/decline`, { method: 'PATCH', body: {}, token },
      );
    } catch {
      if (IS_DEV) return { id: bookingId, status: 'pending' };
      throw new ApiError('Erreur refus course', 500);
    }
  }

  async respondDestinationChange(token: string, bookingId: string, accepted: boolean) {
    return this.request<{ accepted: boolean }>(
      `/bookings/${bookingId}/destination/respond`,
      { method: 'POST', token, body: { accepted } },
    );
  }

  async getActiveRide(token: string) {
    try {
      return await this.request<{ booking: ActiveRide | null }>(
        '/bookings/driver/active', { token },
      );
    } catch {
      if (IS_DEV) {
        const now = new Date();
        now.setHours(now.getHours() + 2);
        return {
          booking: {
            id: 'mock-booking-001',
            status: 'confirmed' as const,
            passengerId: 'p-001',
            passengerName: 'Alice Nguemo',
            flightNumber: 'AF946',
            flightStatus: {
              airline: 'Air France',
              scheduledArrival: now.toISOString(),
              actualArrival: null,
              status: 'delayed' as const,
              minutesUntilLanding: 120,
            },
            destination: 'Bonanjo, Douala',
            vehicleType: 'standard',
            estimatedPrice: 7000,
            departureAirport: 'DLA',
            shareTripEnabled: false,
            type: 'ARRIVAL' as const,
          }
        };
      }
      throw new ApiError('Erreur course active', 500);
    }
  }

  async notifyArrival(token: string, bookingId: string) {
    try {
      return await this.request<{ id: string; status: string }>(
        `/bookings/${bookingId}/arrived`, { method: 'PATCH', body: {}, token },
      );
    } catch {
      if (IS_DEV) return { id: bookingId, status: 'arrived_at_airport' };
      throw new ApiError('Erreur notification arrivée', 500);
    }
  }

  async startRide(token: string, bookingId: string) {
    try {
      return await this.request<{ id: string; status: string }>(
        `/bookings/${bookingId}/start`, { method: 'PATCH', body: {}, token },
      );
    } catch {
      if (IS_DEV) return { id: bookingId, status: 'in_progress' };
      throw new ApiError('Erreur démarrage course', 500);
    }
  }

  async completeRide(token: string, bookingId: string) {
    try {
      return await this.request<{ id: string; status: string }>(
        `/bookings/${bookingId}/complete`, { method: 'PATCH', body: {}, token },
      );
    } catch {
      if (IS_DEV) return { id: bookingId, status: 'completed' };
      throw new ApiError('Erreur complétion course', 500);
    }
  }

  // ── Gains ─────────────────────────────────────────────────────────────────

  async getEarnings(token: string) {
    try {
      return await this.request<{
        today: number;
        thisWeek: number;
        thisMonth: number;
        totalRides: number;
        walletBalance: number;
        currency: string;
      }>('/drivers/earnings', { token });
    } catch {
      if (IS_DEV) return { today: 14000, thisWeek: 63000, thisMonth: 215000, totalRides: 156, currency: 'XAF' };
      throw new ApiError('Erreur chargement gains', 500);
    }
  }

  // ── Retraits ─────────────────────────────────────────────────────────────

  async requestWithdrawal(token: string, amount: number, method: string, mobileNumber: string) {
    return this.request<{ id: string; status: string; amount: number }>(
      '/drivers/withdraw', { method: 'POST', body: { amount, method, mobileNumber }, token },
    );
  }

  async getWithdrawals(token: string, page = 1) {
    return this.request<{ data: any[]; total: number; page: number }>(
      `/drivers/withdrawals?page=${page}`, { token },
    );
  }

  // ── Notation ─────────────────────────────────────────────────────────────

  async ratePassenger(token: string, data: {
    toUserId: string;
    conversationId?: string;
    bookingId?: string;
    score: number;
    comment?: string;
  }) {
    return this.request<{ id: string }>(
      '/ratings', { method: 'POST', body: data, token },
    );
  }

  // ── Détails vol en direct ─────────────────────────────────────────────────

  async getLiveFlightDetails(token: string, flightNumber: string) {
    try {
      return await this.request<{
        found: boolean;
        flight?: {
          flightNumber: string;
          status: string | null;
          airline: { name: string | null };
          aircraft: string | null;
          departure: { airport: string | null; iata: string | null; terminal: string | null; gate: string | null; scheduled: string | null; actual: string | null; delay: number };
          arrival: { airport: string | null; iata: string | null; countryCode: string | null; terminal: string | null; baggage: string | null; scheduled: string | null; predicted: string | null; estimated: string | null; actual: string | null; delay: number };
          live: { latitude: number; longitude: number; altitude: number; speedHorizontal: number; direction: number; isGround: boolean; updatedAt: string } | null;
        };
      }>(`/flights/live/${flightNumber}`, { token });
    } catch {
      return { found: false };
    }
  }

  // ── Panne chauffeur (D2) ─────────────────────────────────────────────────

  async reportBreakdown(token: string, bookingId: string) {
    return this.request<{ bookingId: string; replaced: boolean; status: string }>(
      `/bookings/${bookingId}/breakdown`,
      { method: 'PATCH', token },
    );
  }

  // ── Signalements / Tickets ───────────────────────────────────────────────

  async submitReport(token: string, data: { bookingId?: string; reason: string }) {
    return this.request('/reports', { method: 'POST', token, body: data });
  }

  async getMyReports(token: string) {
    return this.request<any[]>('/reports/me', { token });
  }

  async getReportById(token: string, id: string) {
    return this.request<any>(`/reports/${id}`, { token });
  }

  async addReportMessage(token: string, id: string, message: string, imageUrl?: string) {
    return this.request<any>(`/reports/${id}/messages`, { method: 'POST', token, body: { message, imageUrl } });
  }

  async uploadTicketImage(token: string, uri: string) {
    const baseUrl = this.baseUrl;
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'image.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    (formData as any).append('file', { uri, name: filename, type: mime });
    const res = await fetch(`${baseUrl}/uploads/ticket-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Échec envoi image');
    return (await res.json()) as { url: string };
  }

  // ── Mock ride request (dev uniquement) ───────────────────────────────────

  getMockRideRequest(): RideRequest {
    return { ...MOCK_RIDE, id: `mock-${Date.now()}` };
  }

  // ── Historique trajets ────────────────────────────────────────────────────

  async getDriverRideHistory(token: string, filter: string = 'all', page = 1) {
    return this.request<{ rides: DriverRide[]; total: number; page: number; totalPages: number }>(
      `/bookings/driver/history?filter=${filter}&page=${page}`, { token },
    );
  }

  async getDriverRideDetail(token: string, bookingId: string) {
    return this.request<DriverRideDetail>(`/bookings/${bookingId}/driver-detail`, { token });
  }

  async getDriverRideReceipt(token: string, bookingId: string) {
    return this.request<DriverRideReceipt>(`/bookings/${bookingId}/receipt`, { token });
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  async getWallet(token: string) {
    return this.request<{ balance: number }>('/drivers/me/wallet', { token });
  }

  async getPointsHistory(token: string, page = 1) {
    return this.request<{ data: any[]; total: number; page: number }>(
      `/points/history?page=${page}`, { token },
    );
  }

  async getLoyaltyStatus(token: string) {
    return this.request<{
      tier: string; tierLabel: string; tierColor: string; tierEmoji: string;
      pointsBalance: number; pointsTotal: number;
      nextTier: string | null; nextThreshold: number | null;
      progressPct: number; benefits: string[];
    }>('/users/me/loyalty', { token });
  }

  // ── Frais d'inscription ──────────────────────────────────────────────────

  async getRegistrationFeeStatus(token: string) {
    try {
      return await this.request<{
        required: boolean;
        paid: boolean;
        paidAmount: number | null;
        minFee: number;
        maxFee: number;
        pendingPayment: { id: string; totalAmount: number; provider: string; createdAt: string } | null;
      }>('/drivers/registration-fee/status', { token });
    } catch {
      if (IS_DEV) return { required: true, paid: false, paidAmount: null, minFee: 5000, maxFee: 10000, pendingPayment: null };
      throw new ApiError('Erreur statut frais inscription', 500);
    }
  }

  async initiateRegistrationFee(token: string, provider: 'orange_money_cm' | 'mtn_cm' | 'cash') {
    return this.request<{ reference: string; paymentUrl?: string; status: string }>(
      '/drivers/registration-fee/initiate',
      { method: 'POST', token, body: { provider } },
    );
  }

  // ── Objectifs quotidiens ─────────────────────────────────────────────────────

  async getDailyGoalsProgress(token: string) {
    try {
      return await this.request<{
        goals:    { rides: number; earnings: number; rating: number };
        progress: { rides: number; earnings: number; rating: number };
        pct:      { rides: number; earnings: number; rating: number };
        achieved: { rides: boolean; earnings: boolean; rating: boolean };
      }>('/drivers/daily-goals/progress', { token });
    } catch {
      if (IS_DEV) {
        return {
          goals:    { rides: 5, earnings: 25000, rating: 4.5 },
          progress: { rides: 2, earnings: 8500,  rating: 4.7 },
          pct:      { rides: 40, earnings: 34, rating: 100 },
          achieved: { rides: false, earnings: false, rating: true },
        };
      }
      return null;
    }
  }

  // ── Heatmap zones ────────────────────────────────────────────────────────────

  async getHeatmapZones(token: string) {
    try {
      return await this.request<{
        zones: { lat: number; lng: number; count: number; intensity: 'low' | 'medium' | 'high' }[];
        since: string;
      }>('/bookings/driver/heatmap', { token });
    } catch {
      if (IS_DEV) {
        return {
          zones: [
            { lat: 4.051, lng: 9.702, count: 15, intensity: 'high' as const },
            { lat: 4.043, lng: 9.715, count: 7,  intensity: 'medium' as const },
            { lat: 4.061, lng: 9.694, count: 2,  intensity: 'low' as const },
            { lat: 4.037, lng: 9.728, count: 12, intensity: 'high' as const },
            { lat: 4.055, lng: 9.710, count: 4,  intensity: 'medium' as const },
          ],
          since: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
        };
      }
      throw new ApiError('Erreur carte thermique', 500);
    }
  }

  async initiateCall(token: string, bookingId: string) {
    return this.request<{ phone: string }>(
      `/bookings/${bookingId}/initiate-call`,
      { method: 'POST', token }
    );
  }

  async createProxyCall(token: string, bookingId: string): Promise<{ proxyNumber: string }> {
    return this.request<{ proxyNumber: string }>('/calls/proxy', {
      method: 'POST',
      token,
      body: { bookingId },
    });
  }

  async getOrCreateConversation(token: string, passengerId: string): Promise<{ id: string } | null> {
    try {
      return await this.request<{ id: string }>('/chat/conversations', {
        method: 'POST',
        body: { otherUserId: passengerId },
        token,
      });
    } catch {
      return null;
    }
  }

  async getAnnouncementsFeed(token: string) {
    return this.request<{
      announcements: { id: string; type: string; title: string; body: string; imageUrl: string | null; priority: 'high' | 'normal'; ctaType: 'none' | 'screen' | 'promo_code'; ctaLabel: string | null; ctaValue: string | null; createdAt: string; seen: boolean }[];
      version: { min: string; latest: string; apkUrl: string };
    }>(`/announcements/feed?app=driver`, { token });
  }

  async markAnnouncementSeen(token: string, id: string) {
    return this.request(`/announcements/${id}/seen`, { method: 'POST', token });
  }

  // ── Config par pays ──────────────────────────────────────────────────────
  async getConfigBundle(token: string) {
    return this.request<{
      countryCode: string | null;
      country: { code: string; currency: string; currencySymbol: string | null; currencyDecimals: number } | null;
      settings: Record<string, string>;
    }>(`/config/bundle`, { token });
  }
}

export const driverApi = new DriverApiClient();
export const api = driverApi;
export { ApiError };
