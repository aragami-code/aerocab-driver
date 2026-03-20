import { ApiClient, ApiError } from '@aerocab/mobile-ui';

const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

// ===== DriverApiClient =====
// Extends the shared ApiClient with driver-specific endpoints:
// driver registration, profile, documents, availability, location

class DriverApiClient extends ApiClient {
  private _mockAvailable = false;

  // ===== Driver registration & profile =====

  async registerDriver(
    token: string,
    data: {
      name: string;
      vehicleBrand: string;
      vehicleModel: string;
      vehicleColor: string;
      vehiclePlate: string;
      vehicleYear?: number;
      languages: string[];
    },
  ) {
    try {
      return await this.request<{
        id: string;
        userId: string;
        status: string;
        user: { id: string; phone: string; name: string; role: string };
      }>('/drivers/register', { method: 'POST', body: data, token });
    } catch {
      if (IS_DEV) {
        console.log('[MOCK] registerDriver', data);
        return {
          id: 'dev-driver-profile-001',
          userId: 'dev-driver-001',
          status: 'pending',
          user: { id: 'dev-driver-001', phone: '+237690000002', name: data.name, role: 'driver' },
        };
      }
      throw new ApiError('Erreur inscription chauffeur', 500);
    }
  }

  async getDriverProfile(token: string) {
    try {
      return await this.request<{
        id: string;
        userId: string;
        vehicleBrand: string;
        vehicleModel: string;
        vehicleColor: string;
        vehiclePlate: string;
        vehicleYear: number | null;
        languages: string[];
        status: string;
        isAvailable: boolean;
        ratingAvg: number;
        ratingCount: number;
        totalRides: number;
        user: {
          id: string;
          phone: string;
          name: string | null;
          email: string | null;
          avatarUrl: string | null;
        };
        documents: {
          id: string;
          type: string;
          fileUrl: string;
          status: string;
          rejectionReason: string | null;
        }[];
      }>('/drivers/me', { token });
    } catch {
      if (IS_DEV) {
        console.log('[MOCK] getDriverProfile');
        return {
          id: 'dev-driver-profile-001',
          userId: 'dev-driver-001',
          vehicleBrand: 'Toyota',
          vehicleModel: 'Corolla',
          vehicleColor: 'Blanc',
          vehiclePlate: 'LT 1234 AB',
          vehicleYear: 2020,
          languages: ['fr', 'en'],
          status: 'approved',
          isAvailable: this._mockAvailable,
          ratingAvg: 4.7,
          ratingCount: 42,
          totalRides: 156,
          user: {
            id: 'dev-driver-001',
            phone: '+237690000002',
            name: 'Chauffeur Dev',
            email: null,
            avatarUrl: null,
          },
          documents: [
            { id: 'doc-1', type: 'cni_front', fileUrl: '', status: 'approved', rejectionReason: null },
            { id: 'doc-2', type: 'license', fileUrl: '', status: 'approved', rejectionReason: null },
          ],
        };
      }
      throw new ApiError('Erreur chargement profil chauffeur', 500);
    }
  }

  async updateDriverProfile(
    token: string,
    data: {
      vehicleBrand?: string;
      vehicleModel?: string;
      vehicleColor?: string;
      vehiclePlate?: string;
      vehicleYear?: number;
      languages?: string[];
    },
  ) {
    try {
      return await this.request('/drivers/me', { method: 'PATCH', body: data, token });
    } catch {
      if (IS_DEV) {
        console.log('[MOCK] updateDriverProfile', data);
        return { success: true, ...data };
      }
      throw new ApiError('Erreur mise a jour profil', 500);
    }
  }

  // ===== Driver documents =====

  async uploadDriverDocument(
    token: string,
    data: { type: string; fileUrl: string },
  ) {
    try {
      return await this.request('/drivers/documents', {
        method: 'POST',
        body: data,
        token,
      });
    } catch {
      if (IS_DEV) {
        console.log(`[MOCK] uploadDocument ${data.type}`);
        return { id: `mock-doc-${Date.now()}`, type: data.type, fileUrl: data.fileUrl, status: 'pending', rejectionReason: null };
      }
      throw new ApiError('Erreur upload document', 500);
    }
  }

  async getDriverDocuments(token: string) {
    try {
      return await this.request<
        { id: string; type: string; fileUrl: string; status: string; rejectionReason: string | null }[]
      >('/drivers/documents', { token });
    } catch {
      if (IS_DEV) {
        console.log('[MOCK] getDriverDocuments');
        return [];
      }
      throw new ApiError('Erreur chargement documents', 500);
    }
  }

  async submitDriverForReview(token: string) {
    try {
      return await this.request<{ message: string; status: string }>(
        '/drivers/submit-review',
        { method: 'POST', token },
      );
    } catch {
      if (IS_DEV) {
        console.log('[MOCK] submitForReview');
        return { message: 'Soumis pour verification (mock)', status: 'pending_review' };
      }
      throw new ApiError('Erreur soumission', 500);
    }
  }

  // ===== Availability & location =====

  async toggleDriverAvailability(token: string) {
    try {
      return await this.request<{ isAvailable: boolean; message: string }>(
        '/drivers/toggle-availability',
        { method: 'POST', token },
      );
    } catch {
      if (IS_DEV) {
        this._mockAvailable = !this._mockAvailable;
        console.log(`[MOCK] toggleAvailability -> ${this._mockAvailable}`);
        return {
          isAvailable: this._mockAvailable,
          message: this._mockAvailable ? 'Vous etes maintenant disponible' : 'Vous etes hors ligne',
        };
      }
      throw new ApiError('Erreur disponibilite', 500);
    }
  }

  async updateDriverLocation(
    token: string,
    data: { latitude: number; longitude: number },
  ) {
    try {
      return await this.request('/drivers/location', {
        method: 'PATCH',
        body: data,
        token,
      });
    } catch {
      if (IS_DEV) {
        return { success: true };
      }
      throw new ApiError('Erreur mise a jour position', 500);
    }
  }

  // ===== Ride management =====

  async getActiveRide(token: string) {
    try {
      return await this.request<{
        booking: {
          id: string;
          passengerId: string;
          passengerName: string | null;
          passengerPhone: string | null;
          departureAirport: string;
          destination: string;
          flightNumber: string | null;
          estimatedPrice: number;
          status: 'confirmed' | 'arrived_at_airport' | 'in_progress';
        } | null;
      }>('/bookings/active', { token });
    } catch {
      if (IS_DEV) return { booking: null };
      throw new ApiError('Erreur chargement course active', 500);
    }
  }

  async getEarnings(token: string) {
    try {
      return await this.request<{ today: number; thisWeek: number; thisMonth: number }>(
        '/bookings/earnings', { token }
      );
    } catch {
      if (IS_DEV) return { today: 0, thisWeek: 0, thisMonth: 0 };
      throw new ApiError('Erreur gains', 500);
    }
  }

  async acceptBooking(token: string, bookingId: string) {
    return this.request<{ id: string; status: string }>(
      `/bookings/${bookingId}/accept`, { method: 'POST', token }
    );
  }

  async declineBooking(token: string, bookingId: string) {
    return this.request<{ id: string; status: string }>(
      `/bookings/${bookingId}/decline`, { method: 'POST', token }
    );
  }

  async notifyArrival(token: string, bookingId: string) {
    return this.request<{ id: string; status: string }>(
      `/bookings/${bookingId}/arrive`, { method: 'POST', token }
    );
  }

  async startRide(token: string, bookingId: string) {
    return this.request<{ id: string; status: string }>(
      `/bookings/${bookingId}/start`, { method: 'POST', token }
    );
  }

  async completeRide(token: string, bookingId: string) {
    return this.request<{ id: string; status: string; estimatedPrice: number }>(
      `/bookings/${bookingId}/complete`, { method: 'POST', token }
    );
  }

  async getMyBookings(token: string) {
    try {
      return await this.request<{ bookings: unknown[] }>('/bookings/driver/history', { token });
    } catch {
      if (IS_DEV) return { bookings: [] };
      throw new ApiError('Erreur historique', 500);
    }
  }
}

export const api = new DriverApiClient();
export { ApiError };
