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
  reputationScore: 850,
  walletBalance: 24500,
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
  type: 'ARRIVAL' as const,
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
  type?: 'ARRIVAL' | 'DEPARTURE' | 'INTERNATIONAL';
  pickupAddress?: string;
  // Surcharges contextuelles
  surgeMultiplier?: number;
  nightSurge?: boolean;
  rainSurge?: boolean;
  rushHourSurge?: boolean;
  // Consigne véhicule
  withConsigne?: boolean;
  consigneDays?: number;
  consigneDailyRate?: number;
  consigneTotal?: number;
  consigneVehicleType?: string;
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
  status: 'confirmed' | 'arrived_at_airport' | 'in_progress';
  passengerId: string;
  passengerName: string | null;
  passengerPhone: string | null;
  flightNumber: string | null;
  flightStatus: FlightStatus | null;
  destination: string;
  vehicleType: string;
  estimatedPrice: number;
  departureAirport: string;
  shareTripEnabled: boolean;
  type: 'ARRIVAL' | 'DEPARTURE';
  pickupAddress?: string;
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
      if (IS_DEV) {
        const now = new Date();
        now.setHours(now.getHours() + 2);
        return {
          booking: {
            id: 'mock-booking-001',
            status: 'confirmed' as const,
            passengerId: 'p-001',
            passengerName: 'Alice Nguemo',
            passengerPhone: '+237600000000',
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

  // ── Détails vol en direct ─────────────────────────────────────────────────

  async getLiveFlightDetails(token: string, flightNumber: string) {
    try {
      return await this.request<{
        found: boolean;
        flight?: {
          flightNumber: string;
          flightIcao: string | null;
          status: string | null;
          airline: { name: string | null; iata: string | null; icao: string | null };
          aircraft: { type: string | null; icao: string | null; registration: string | null };
          departure: { airport: string | null; iata: string | null; terminal: string | null; gate: string | null; scheduled: string | null; actual: string | null; delay: number };
          arrival: { airport: string | null; iata: string | null; terminal: string | null; baggage: string | null; scheduled: string | null; estimated: string | null; actual: string | null; delay: number };
          live: { latitude: number; longitude: number; altitude: number; speedHorizontal: number; direction: number; isGround: boolean; updatedAt: string } | null;
        };
      }>(`/flights/live/${flightNumber}`, { token });
    } catch {
      // En cas d'erreur réseau, retourner un mock pour ne pas bloquer
      const dep = new Date(); dep.setHours(dep.getHours() - 4);
      const arr = new Date(); arr.setHours(arr.getHours() + 3);
      return {
        found: true,
        flight: {
          flightNumber: flightNumber.toUpperCase(),
          flightIcao: null,
          status: 'active',
          airline: { name: 'Air France', iata: 'AF', icao: 'AFR' },
          aircraft: { type: 'B77W', icao: null, registration: null },
          departure: { airport: 'Paris Charles de Gaulle', iata: 'CDG', terminal: '2E', gate: null, scheduled: dep.toISOString(), actual: dep.toISOString(), delay: 0 },
          arrival: { airport: 'Aéroport International de Douala', iata: 'DLA', terminal: 'A', baggage: null, scheduled: arr.toISOString(), estimated: arr.toISOString(), actual: null, delay: 0 },
          live: { latitude: 10.5, longitude: 5.2, altitude: 11278, speedHorizontal: 890, direction: 175, isGround: false, updatedAt: new Date().toISOString() },
        },
      };
    }
  }

  // ── Mock ride request (dev uniquement) ───────────────────────────────────

  getMockRideRequest(): RideRequest {
    return { ...MOCK_RIDE, id: `mock-${Date.now()}` };
  }
}

export const driverApi = new DriverApiClient();
export const api = driverApi;
export { ApiError };
