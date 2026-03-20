import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  AppState,
  AppStateStatus,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { Clock, XCircle, MapPin, Plane, DollarSign, TrendingUp } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { COLORS, SPACING, DRIVER_LOCATION_UPDATE_INTERVAL_MS, formatCurrency, BORDER_RADIUS } from '@aerocab/shared';
import { useHaptic } from '@aerocab/mobile-ui';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { useAuthStore } from '../../stores/authStore';

type ActiveRide = {
  id: string;
  passengerId: string;
  passengerName: string | null;
  passengerPhone: string | null;
  departureAirport: string;
  destination: string;
  flightNumber: string | null;
  estimatedPrice: number;
  status: 'confirmed' | 'arrived_at_airport' | 'in_progress';
};

type Earnings = {
  today: number;
  thisWeek: number;
  thisMonth: number;
};

export default function DriverDashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [profile, setProfile] = useState<{
    id: string;
    status: string;
    isAvailable: boolean;
    ratingAvg: number;
    ratingCount: number;
    totalRides: number;
    vehicleBrand: string;
    vehicleModel: string;
  } | null>(null);
  const [toggling, setToggling] = useState(false);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [earnings, setEarnings] = useState<Earnings>({ today: 0, thisWeek: 0, thisMonth: 0 });
  const [rideActionLoading, setRideActionLoading] = useState(false);

  useEffect(() => {
    if (token) loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.getDriverProfile(token!);
      setProfile(data);

      // Load active ride and earnings in parallel
      const [rideData, earningsData] = await Promise.all([
        api.getActiveRide(token!),
        api.getEarnings(token!),
      ]);
      setActiveRide(rideData.booking);
      setEarnings(earningsData);
    } catch {
      // Profile may not exist yet
    }
  };

  // ===== Socket connection =====

  const connectSocket = useCallback(() => {
    if (!token || !profile?.id) return;

    const socket = socketService.connect(token);
    socketService.joinDriverRoom(profile.id);

    socket.on('booking:new_request', (rideData: unknown) => {
      router.push({
        pathname: '/(tabs)/ride-request',
        params: { rideJson: JSON.stringify(rideData) },
      });
    });
  }, [token, profile?.id]);

  useEffect(() => {
    connectSocket();
    return () => {
      socketService.disconnect();
    };
  }, [connectSocket]);

  // Reconnect socket when app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        connectSocket();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [connectSocket]);

  // ===== Availability toggle =====

  const handleToggle = async () => {
    medium();
    setToggling(true);
    try {
      const result = await api.toggleDriverAvailability(token!);
      setProfile((prev) =>
        prev ? { ...prev, isAvailable: result.isAvailable } : prev,
      );
    } catch {
      // Ignore
    } finally {
      setToggling(false);
    }
  };

  // ===== Driver location tracking =====

  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendLocation = useCallback(async () => {
    if (!token) return;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await api.updateDriverLocation(token, {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      // Silently fail - location will retry on next interval
    }
  }, [token]);

  useEffect(() => {
    if (!profile?.isAvailable || !token) {
      // Clear interval when driver goes offline
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      return;
    }

    // Driver is available: request permission and start sending location
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      // Send immediately once
      await sendLocation();

      // Then send at the configured interval
      locationIntervalRef.current = setInterval(
        sendLocation,
        DRIVER_LOCATION_UPDATE_INTERVAL_MS,
      );
    })();

    return () => {
      cancelled = true;
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [profile?.isAvailable, token, sendLocation]);

  // ===== Ride action handlers =====

  const handleNotifyArrival = async () => {
    if (!activeRide) return;
    setRideActionLoading(true);
    try {
      await api.notifyArrival(token!, activeRide.id);
      setActiveRide((prev) => prev ? { ...prev, status: 'arrived_at_airport' } : prev);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      Alert.alert('Erreur', msg);
    } finally {
      setRideActionLoading(false);
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    setRideActionLoading(true);
    try {
      await api.startRide(token!, activeRide.id);
      setActiveRide((prev) => prev ? { ...prev, status: 'in_progress' } : prev);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      Alert.alert('Erreur', msg);
    } finally {
      setRideActionLoading(false);
    }
  };

  const handleCompleteRide = () => {
    Alert.alert(
      'Terminer la course',
      'Confirmez-vous la fin de la course ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer',
          style: 'destructive',
          onPress: async () => {
            if (!activeRide) return;
            setRideActionLoading(true);
            try {
              await api.completeRide(token!, activeRide.id);
              setActiveRide(null);
              await loadData();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Erreur';
              Alert.alert('Erreur', msg);
            } finally {
              setRideActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const { medium } = useHaptic();

  const isApproved = profile?.status === 'approved';
  const isPending = profile?.status === 'pending';
  const isRejected = profile?.status === 'rejected';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerBg}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>
              Bonjour, {user?.name || 'Chauffeur'}
            </Text>
            <Text style={styles.subGreeting}>
              {profile?.vehicleBrand} {profile?.vehicleModel}
            </Text>
          </View>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        </View>
      </View>

      {/* Status banner */}
      {isPending && (
        <View style={[styles.statusBanner, styles.statusPending]}>
          <Clock size={24} color={COLORS.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>Verification en cours</Text>
            <Text style={styles.statusDesc}>
              Votre dossier est en attente de validation par notre equipe
            </Text>
          </View>
        </View>
      )}

      {isRejected && (
        <View style={[styles.statusBanner, styles.statusRejected]}>
          <XCircle size={24} color={COLORS.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>Dossier rejete</Text>
            <Text style={styles.statusDesc}>
              Veuillez corriger vos documents et resoumettre
            </Text>
          </View>
        </View>
      )}

      {/* Availability toggle (only for approved drivers) */}
      {isApproved && (
        <Pressable
          style={[
            styles.availabilityCard,
            profile?.isAvailable
              ? styles.availabilityOnline
              : styles.availabilityOffline,
          ]}
          onPress={handleToggle}
          disabled={toggling}
        >
          <View style={styles.availabilityDot}>
            <View
              style={[
                styles.dot,
                profile?.isAvailable ? styles.dotOnline : styles.dotOffline,
              ]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.availabilityTitle}>
              {profile?.isAvailable ? 'Disponible' : 'Indisponible'}
            </Text>
            <Text style={styles.availabilityDesc}>
              {profile?.isAvailable
                ? 'Vous etes visible sur la carte'
                : 'Appuyez pour vous rendre disponible'}
            </Text>
          </View>
          <View style={styles.toggleTrack}>
            <View
              style={[
                styles.toggleThumb,
                profile?.isAvailable && styles.toggleThumbOn,
              ]}
            />
          </View>
        </Pressable>
      )}

      {/* Active Ride Card */}
      {isApproved && activeRide && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Course en cours</Text>
          <View style={styles.rideCard}>
            <View style={styles.rideRow}>
              <MapPin size={16} color={COLORS.primary} />
              <Text style={styles.rideDestination}>{activeRide.destination}</Text>
            </View>
            <View style={styles.rideRow}>
              <Plane size={16} color={COLORS.grayMedium} />
              <Text style={styles.rideSub}>
                {activeRide.departureAirport}
                {activeRide.flightNumber ? ` — Vol ${activeRide.flightNumber}` : ''}
              </Text>
            </View>
            {activeRide.passengerName && (
              <Text style={styles.ridePassenger}>
                Passager : {activeRide.passengerName}
              </Text>
            )}
            <Text style={styles.ridePrice}>{formatCurrency(activeRide.estimatedPrice)}</Text>

            <View style={styles.rideStatusRow}>
              <View
                style={[
                  styles.rideStatusBadge,
                  activeRide.status === 'confirmed' && styles.rideStatusConfirmed,
                  activeRide.status === 'arrived_at_airport' && styles.rideStatusArrived,
                  activeRide.status === 'in_progress' && styles.rideStatusInProgress,
                ]}
              >
                <Text style={styles.rideStatusText}>
                  {activeRide.status === 'confirmed' && 'En route vers l\'aeroport'}
                  {activeRide.status === 'arrived_at_airport' && 'Arrive a l\'aeroport'}
                  {activeRide.status === 'in_progress' && 'Course en cours'}
                </Text>
              </View>
            </View>

            {rideActionLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.md }} />
            ) : (
              <>
                {activeRide.status === 'confirmed' && (
                  <Pressable style={styles.rideActionBtn} onPress={handleNotifyArrival}>
                    <Text style={styles.rideActionBtnText}>Je suis arrive</Text>
                  </Pressable>
                )}
                {activeRide.status === 'arrived_at_airport' && (
                  <Pressable style={styles.rideActionBtn} onPress={handleStartRide}>
                    <Text style={styles.rideActionBtnText}>Passager a bord — Demarrer</Text>
                  </Pressable>
                )}
                {activeRide.status === 'in_progress' && (
                  <Pressable
                    style={[styles.rideActionBtn, styles.rideActionBtnComplete]}
                    onPress={handleCompleteRide}
                  >
                    <Text style={styles.rideActionBtnText}>Terminer la course</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {/* Earnings */}
      {isApproved && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gains</Text>
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <TrendingUp size={16} color={COLORS.success} />
              <Text style={styles.earningsLabel}>Aujourd'hui</Text>
              <Text style={styles.earningsValue}>{formatCurrency(earnings.today)}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.earningsRow}>
              <DollarSign size={16} color={COLORS.primary} />
              <Text style={styles.earningsLabel}>Cette semaine</Text>
              <Text style={styles.earningsValue}>{formatCurrency(earnings.thisWeek)}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.earningsRow}>
              <DollarSign size={16} color={COLORS.primaryLight} />
              <Text style={styles.earningsLabel}>Ce mois</Text>
              <Text style={styles.earningsValue}>{formatCurrency(earnings.thisMonth)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Stats */}
      {isApproved && (
        <View style={styles.statsRow}>
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.statCard}>
            <Text style={styles.statValue}>
              {profile?.ratingAvg.toFixed(1) || '0.0'}
            </Text>
            <Text style={styles.statLabel}>Note moyenne</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.totalRides || 0}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.ratingCount || 0}</Text>
            <Text style={styles.statLabel}>Avis</Text>
          </Animated.View>
        </View>
      )}

      {/* Quick info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations rapides</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Statut</Text>
            <View
              style={[
                styles.badge,
                isApproved && styles.badgeSuccess,
                isPending && styles.badgeWarning,
                isRejected && styles.badgeError,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isApproved && styles.badgeTextSuccess,
                  isPending && styles.badgeTextWarning,
                  isRejected && styles.badgeTextError,
                ]}
              >
                {isApproved
                  ? 'Approuve'
                  : isPending
                    ? 'En attente'
                    : isRejected
                      ? 'Rejete'
                      : 'Inconnu'}
              </Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicule</Text>
            <Text style={styles.infoValue}>
              {profile
                ? `${profile.vehicleBrand} ${profile.vehicleModel}`
                : '--'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.versionText}>AeroCab Pro v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerBg: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 28,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  subGreeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 16,
    gap: 12,
  },
  statusPending: {
    backgroundColor: `${COLORS.warning}12`,
    borderWidth: 1,
    borderColor: `${COLORS.warning}30`,
  },
  statusRejected: {
    backgroundColor: `${COLORS.error}10`,
    borderWidth: 1,
    borderColor: `${COLORS.error}25`,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 2,
  },
  statusDesc: {
    fontSize: 12,
    color: COLORS.grayDark,
    lineHeight: 16,
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 16,
    gap: 12,
  },
  availabilityOnline: {
    backgroundColor: `${COLORS.success}10`,
    borderWidth: 1.5,
    borderColor: `${COLORS.success}30`,
  },
  availabilityOffline: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
  },
  availabilityDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotOnline: {
    backgroundColor: COLORS.success,
  },
  dotOffline: {
    backgroundColor: COLORS.grayMedium,
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  availabilityDesc: {
    fontSize: 12,
    color: COLORS.grayDark,
    marginTop: 1,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.grayLight,
    padding: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.success,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.grayMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  rideCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 8,
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rideDestination: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  rideSub: {
    fontSize: 13,
    color: COLORS.grayDark,
  },
  ridePassenger: {
    fontSize: 13,
    color: COLORS.grayDark,
  },
  ridePrice: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  rideStatusRow: {
    flexDirection: 'row',
  },
  rideStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rideStatusConfirmed: {
    backgroundColor: `${COLORS.warning}20`,
  },
  rideStatusArrived: {
    backgroundColor: `${COLORS.primary}15`,
  },
  rideStatusInProgress: {
    backgroundColor: `${COLORS.success}15`,
  },
  rideStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.grayDark,
  },
  rideActionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  rideActionBtnComplete: {
    backgroundColor: COLORS.success,
  },
  rideActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  earningsCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.card,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  earningsLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.grayDark,
  },
  earningsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.grayMedium,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.grayDark,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.grayLight,
    marginVertical: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeSuccess: {
    backgroundColor: `${COLORS.success}15`,
  },
  badgeWarning: {
    backgroundColor: `${COLORS.warning}15`,
  },
  badgeError: {
    backgroundColor: `${COLORS.error}12`,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextSuccess: {
    color: COLORS.success,
  },
  badgeTextWarning: {
    color: COLORS.warning,
  },
  badgeTextError: {
    color: COLORS.error,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.grayMedium,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
});
