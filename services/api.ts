import { ApiClient, ApiError } from '../lib/api-base';

const IS_DEV = !process.env.EXPO_PUBLIC_API_URL && (typeof __DEV__ !== 'undefined' ? __DEV__ : true);

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_PROFILE = {
  id: 'drv-mock-001',
  status: 'approved' as const,
  isAvailable: false,
  vehicleBrand: 'Toyota',
  vehicleModel: 'Corolla',
  vehicleColor: 'Blanc',
  vehiclePlate: 'LT 1234 AB',
  languages: ['fr', 'en'],
  ratingAvg: 4.8,
  ratingCount: 42,
  totalRides: 156,
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
};

// ── Types ────────────────────────────────────────────────────────────────────
export type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type RideRequest = {
  id: string;
  passengerId: string;
  passengerName: string | null;
  flightNumber: string | null;
  destination: string;
  vehicleType: string;
  estimatedPrice: number;
  departureAirport: string;
  seats: number;
};

export type ActiveRide = {
  id: string;
  status: 'confirmed' | 'arrived_at_airport' | 'in_progress';
  passengerId: string;
  passengerName: string | null;
  passengerPhone: string | null;
  flightNumber: string | null;
  destination: string;
  vehicleType: string;
  estimatedPrice: number;
  departureAirport: string;
  shareTripEnabled: boolean;
};

// ── DriverApiClient ───────────────────────────────────────────────────────────
class DriverApiClient extends ApiClient {

  // ── Profil chauffeur ──────────────────────────────────────────────────────

  async registerDriver(token: string, data: {
    vehicleBrand: string;
    vehicleModel: string;
    vehicleColor: string;
    vehiclePlate: string;
    languages: string[];
  }) {
    try {
      return await this.request<{ id: string; status: string }>(
        '/drivers/register', { method: 'POST', body: data, token },
      );
    } catch {
      if (IS_DEV) return { id: 'drv-mock', status: 'pending' };
      throw new ApiError('Erreur enregistrement chauffeur', 500);
    }
  }

  async getMyProfile(token: string) {
    try {
      return await this.request<{
        id: string;
        status: DriverStatus;
        isAvailable: boolean;
        vehicleBrand: string;
        vehicleModel: string;
        vehicleColor: string;
        vehiclePlate: string;
        languages: string[];
        ratingAvg: number;
        ratingCount: number;
        totalRides: number;
        user: { id: string; name: string | null; phone: string; avatarUrl: string | null };
      }>('/drivers/me', { token });
    } catch {
      if (IS_DEV) return MOCK_PROFILE;
      throw new ApiError('Erreur chargement profil', 500);
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

  async uploadDocument(token: string, data: {
    type: 'cni_front' | 'cni_back' | 'license' | 'registration' | 'vehicle_photo';
    uri: string;
    mimeType?: string;
  }) {
    if (IS_DEV) return { id: `doc-mock-${Date.now()}`, type: data.type, status: 'pending' };

    const apiUrl = process.env.EXPO_PUBLIC_API_URL!;
    const formData = new FormData();
    formData.append('file', {
      uri: data.uri,
      name: `${data.type}.jpg`,
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

  async getActiveRide(token: string) {
    try {
      return await this.request<{ booking: ActiveRide | null }>(
        '/bookings/driver/active', { token },
      );
    } catch {
      if (IS_DEV) return { booking: null };
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
        currency: string;
      }>('/drivers/earnings', { token });
    } catch {
      if (IS_DEV) return { today: 14000, thisWeek: 63000, thisMonth: 215000, totalRides: 156, currency: 'XAF' };
      throw new ApiError('Erreur chargement gains', 500);
    }
  }

  // ── Notation ─────────────────────────────────────────────────────────────

  async ratePassenger(token: string, data: {
    toUserId: string;
    conversationId: string;
    score: number;
    comment?: string;
  }) {
    try {
      return await this.request<{ id: string }>(
        '/ratings', { method: 'POST', body: data, token },
      );
    } catch {
      if (IS_DEV) return { id: `rating-mock-${Date.now()}` };
      throw new ApiError('Erreur notation', 500);
    }
  }

  // ── Mock ride request (dev uniquement) ───────────────────────────────────

  getMockRideRequest(): RideRequest {
    return { ...MOCK_RIDE, id: `mock-${Date.now()}` };
  }
}

export const driverApi = new DriverApiClient();
export { ApiError };
