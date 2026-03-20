// ===== AeroCab Brand Colors =====
export const COLORS = {
  primary: '#1D2C4D',
  primaryLight: '#2A4070',
  primaryDark: '#141E35',
  accent: '#FAB81F',
  accentLight: '#FDD66B',
  black: '#191817',
  grayDark: '#4A4A4A',
  grayMedium: '#9B9B9B',
  grayLight: '#E8E8E8',
  background: '#F7F8FA',
  white: '#FFFFFF',
  success: '#27AE60',
  error: '#E74C3C',
  warning: '#F39C12',
} as const;

// ===== Airports =====
export const AIRPORTS = {
  DLA: {
    code: 'DLA',
    name: 'Douala International Airport',
    city: 'Douala',
    lat: 4.0061,
    lng: 9.7194,
  },
  NSI: {
    code: 'NSI',
    name: 'Yaounde Nsimalen International Airport',
    city: 'Yaounde',
    lat: 3.7226,
    lng: 11.5533,
  },
} as const;

// ===== Business Constants =====
export const ACCESS_PRICE = 2500;
export const ACCESS_CURRENCY = 'XAF';
export const ACCESS_DURATION_HOURS = 48;

// ===== Auth Constants =====
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_COOLDOWN_MINUTES = 10;
export const JWT_EXPIRY_DAYS = 30;

// ===== Rating Constants =====
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_MIN_REVIEWS_TO_SHOW = 3;
export const RATING_COMMENT_MAX_LENGTH = 200;

// ===== Driver Location =====
export const DRIVER_LOCATION_UPDATE_INTERVAL_MS = 30_000;

// ===== UI Constants =====
export const BORDER_RADIUS = {
  button: 12,
  card: 16,
  bottomSheet: 24,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const MIN_TOUCH_TARGET = 44;

// ===== Supported Languages =====
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// ===== Payment Methods =====
export const PAYMENT_METHODS = ['orange_money', 'mtn_momo'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ===== Document Types =====
export const REQUIRED_DRIVER_DOCUMENTS = [
  'cni_front',
  'cni_back',
  'license',
  'registration',
  'vehicle_photo',
] as const;

// ===== Default Country (Cameroun) =====
export const DEFAULT_COUNTRY = {
  code: 'CM',
  name: 'Cameroun',
  currency: ACCESS_CURRENCY,
  accessPrice: ACCESS_PRICE,
  accessDurationHours: ACCESS_DURATION_HOURS,
  paymentMethods: [...PAYMENT_METHODS],
  airports: [AIRPORTS.DLA, AIRPORTS.NSI],
  isActive: true,
} as const;

// ===== User Types =====
export type UserRole = 'passenger' | 'driver' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Driver Types =====
export type DriverVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface DriverProfile {
  id: string;
  userId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  vehiclePlate: string;
  languages: string[];
  isAvailable: boolean;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: Date | null;
  verificationStatus: DriverVerificationStatus;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentType =
  | 'cni_front'
  | 'cni_back'
  | 'license'
  | 'registration'
  | 'vehicle_photo';

export interface DriverDocument {
  id: string;
  driverId: string;
  type: DocumentType;
  fileUrl: string;
  uploadedAt: Date;
}

// ===== Flight Types =====
export type FlightSource = 'api' | 'manual';

export interface Flight {
  id: string;
  userId: string;
  flightNumber: string | null;
  airline: string | null;
  arrivalAirport: string;
  scheduledArrival: Date;
  actualArrival: Date | null;
  source: FlightSource;
  createdAt: Date;
}

// ===== Access Pass Types =====
export type AccessPassStatus = 'pending' | 'active' | 'expired' | 'failed';

export interface AccessPass {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  paymentRef: string | null;
  status: AccessPassStatus;
  activatedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// ===== Chat Types =====
export interface Conversation {
  id: string;
  passengerId: string;
  driverId: string;
  flightId: string | null;
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}

// ===== Rating Types =====
export interface Rating {
  id: string;
  conversationId: string;
  raterId: string;
  ratedId: string;
  score: number;
  comment: string | null;
  createdAt: Date;
}

// ===== Report Types =====
export type ReportStatus = 'open' | 'in_progress' | 'resolved';

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  conversationId: string | null;
  reason: string;
  status: ReportStatus;
  adminNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

// ===== Country / Config Types =====
export interface Airport {
  code: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

export interface Country {
  id: string;
  code: string;
  name: string;
  currency: string;
  accessPrice: number;
  accessDurationHours: number;
  airports: Airport[];
  paymentMethods: string[];
  isActive: boolean;
}

// ===== Phone Formatting =====
/**
 * Format phone number to international format (Cameroon default)
 * Input: "6XXXXXXXX" → Output: "+2376XXXXXXXX"
 */
export function formatPhoneNumber(phone: string, countryCode = '237'): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith(countryCode)) {
    return `+${cleaned}`;
  }
  return `+${countryCode}${cleaned}`;
}

/**
 * Strip international prefix from phone number
 * Input: "+2376XXXXXXXX" → Output: "6XXXXXXXX"
 */
export function stripPhonePrefix(phone: string, countryCode = '237'): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith(countryCode)) {
    return cleaned.slice(countryCode.length);
  }
  return cleaned;
}

// ===== Date / Time Helpers =====
/**
 * Check if an access pass is still valid (not expired)
 */
export function isAccessPassActive(
  activatedAt: Date | null,
  expiresAt: Date | null,
): boolean {
  if (!activatedAt || !expiresAt) return false;
  return new Date() < new Date(expiresAt);
}

/**
 * Format duration remaining in human-readable form
 * Returns e.g. "23h 45min" or "Expiré"
 */
export function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = new Date(expiresAt).getTime() - now.getTime();
  if (diff <= 0) return 'Expiré';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

// ===== Currency Formatting =====
/**
 * Format amount in XAF (no decimals, space separator)
 * Input: 2500 → Output: "2 500 FCFA"
 */
export function formatCurrency(
  amount: number,
  currency = 'XAF',
): string {
  const formatted = amount.toLocaleString('fr-FR');
  const label = currency === 'XAF' ? 'FCFA' : currency;
  return `${formatted} ${label}`;
}

// ===== Rating Helpers =====
/**
 * Compute average rating from scores array
 */
export function computeAverageRating(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

// ===== Airport Helpers =====
/**
 * Get airport label: "Douala (DLA)"
 */
export function formatAirportLabel(airport: {
  code: string;
  city: string;
}): string {
  return `${airport.city} (${airport.code})`;
}
