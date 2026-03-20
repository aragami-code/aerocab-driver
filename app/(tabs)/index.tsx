import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, Switch, Platform, Linking, AppState,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wifi, WifiOff, MapPin, Star, TrendingUp,
  Clock, Car, Phone, MessageCircle, Play, CheckCircle,
  AlertCircle, ChevronRight, Navigation,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS, DRIVER_LOCATION_UPDATE_INTERVAL_MS, formatCurrency } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi, type RideRequest, type ActiveRide, type DriverStatus } from '../../services/api';
import { socketService } from '../../services/socket';

const IS_DEV = !process.env.EXPO_PUBLIC_API_URL && (typeof __DEV__ !== 'undefined' ? __DEV__ : true);

// ── Status banner ─────────────────────────────────────────────────────────────
function StatusBanner({ status }: { status: DriverStatus }) {
  if (status === 'approved') return null;

  const configs: Record<Exclude<DriverStatus, 'approved'>, { bg: string; icon: React.ReactNode; text: string }> = {
    pending: {
      bg: '#FFF8E1',
      icon: <Clock size={16} color={COLORS.warning} />,
      text: "Votre dossier est en cours de vérification. Vous recevrez une notification dès que c'est approuvé.",
    },
    rejected: {
      bg: '#FDECEA',
      icon: <AlertCircle size={16} color={COLORS.error} />,
      text: "Votre dossier a été rejeté. Consultez l'onglet Statut pour plus de détails.",
    },
    suspended: {
      bg: '#FFF3E0',
      icon: <AlertCircle size={16} color={COLORS.warning} />,
      text: 'Votre compte est suspendu. Contactez le support pour plus d\'informations.',
    },
  };

  const cfg = configs[status];
  return (
    <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
      {cfg.icon}
      <Text style={styles.statusBannerText}>{cfg.text}</Text>
    </View>
  );
}

// ── Active ride card ──────────────────────────────────────────────────────────
function ActiveRideCard({
  ride,
  onArrival,
  onStart,
  onComplete,
  onNavigate,
  onChat,
  onCall,
  loading,
}: {
  ride: ActiveRide;
  onArrival: () => void;
  onStart: () => void;
  onComplete: () => void;
  onNavigate: () => void;
  onChat: () => void;
  onCall: () => void;
  loading: boolean;
}) {
  const statusLabel = {
    confirmed: 'En route vers l\'aéroport',
    arrived_at_airport: 'Arrivé — attente passager',
    in_progress: 'Course en cours',
  }[ride.status];

  const statusDotColor = {
    confirmed: COLORS.warning,
    arrived_at_airport: '#2196F3',
    in_progress: COLORS.success,
  }[ride.status];

  return (
    <View style={styles.activeRideCard}>
      <View style={styles.activeRideHeader}>
        <View style={styles.activeRideBadge}>
          <View style={[styles.dot, { backgroundColor: statusDotColor }]} />
          <Text style={styles.activeRideBadgeText}>{statusLabel}</Text>
        </View>
        <Text style={styles.activeRidePrice}>{formatCurrency(ride.estimatedPrice)}</Text>
      </View>

      <View style={styles.activeRideRow}>
        <MapPin size={16} color={COLORS.primary} />
        <Text style={styles.activeRideDestination} numberOfLines={1}>{ride.destination}</Text>
      </View>

      {ride.flightNumber && (
        <View style={styles.activeRideRow}>
          <Car size={16} color={COLORS.grayMedium} />
          <Text style={styles.activeRideSubtext}>Vol {ride.flightNumber} — {ride.departureAirport}</Text>
        </View>
      )}

      <View style={styles.activeRidePassenger}>
        <View style={styles.activeRideAvatarPlaceholder}>
          <Text style={styles.activeRideAvatarText}>
            {ride.passengerName ? ride.passengerName[0].toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={styles.activeRidePassengerName}>{ride.passengerName ?? 'Passager'}</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.iconBtn} onPress={onNavigate}>
          <Navigation size={18} color={COLORS.primary} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onChat}>
          <MessageCircle size={18} color={COLORS.primary} />
        </Pressable>
        {ride.passengerPhone && (
          <Pressable style={styles.iconBtn} onPress={onCall}>
            <Phone size={18} color={COLORS.success} />
          </Pressable>
        )}
      </View>

      {/* Actions selon l'étape */}
      <View style={styles.activeRideActions}>
        {ride.status === 'confirmed' && (
          <Pressable style={[styles.actionBtn, styles.actionBtnArrival]} onPress={onArrival} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
              <>
                <MapPin size={16} color={COLORS.white} />
                <Text style={styles.actionBtnText}>Je suis arrivé à l'aéroport</Text>
              </>
            )}
          </Pressable>
        )}

        {ride.status === 'arrived_at_airport' && (
          <Pressable style={[styles.actionBtn, styles.actionBtnStart]} onPress={onStart} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
              <>
                <Play size={16} color={COLORS.white} />
                <Text style={styles.actionBtnText}>Passager à bord — Démarrer</Text>
              </>
            )}
          </Pressable>
        )}

        {ride.status === 'in_progress' && (
          <Pressable style={[styles.actionBtn, styles.actionBtnComplete]} onPress={onComplete} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
              <>
                <CheckCircle size={16} color={COLORS.white} />
                <Text style={styles.actionBtnText}>Terminer la course</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Earnings card ─────────────────────────────────────────────────────────────
function EarningsCard({ today, thisWeek, thisMonth }: { today: number; thisWeek: number; thisMonth: number }) {
  return (
    <View style={styles.earningsCard}>
      <View style={styles.earningsHeader}>
        <TrendingUp size={18} color={COLORS.primary} />
        <Text style={styles.earningsTitle}>Mes gains</Text>
      </View>
      <View style={styles.earningsRow}>
        <View style={styles.earningsStat}>
          <Text style={styles.earningsAmount}>{formatCurrency(today)}</Text>
          <Text style={styles.earningsLabel}>Aujourd'hui</Text>
        </View>
        <View style={styles.earningsDivider} />
        <View style={styles.earningsStat}>
          <Text style={styles.earningsAmount}>{formatCurrency(thisWeek)}</Text>
          <Text style={styles.earningsLabel}>Cette semaine</Text>
        </View>
        <View style={styles.earningsDivider} />
        <View style={styles.earningsStat}>
          <Text style={styles.earningsAmount}>{formatCurrency(thisMonth)}</Text>
          <Text style={styles.earningsLabel}>Ce mois</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const token = useAuthStore((s) => s.token)!;

  const [driverStatus, setDriverStatus] = useState<DriverStatus>('pending');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [totalRides, setTotalRides] = useState(0);
  const [driverName, setDriverName] = useState('');
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [earnings, setEarnings] = useState({ today: 0, thisWeek: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [rideActionLoading, setRideActionLoading] = useState(false);

  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load initial data ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadError(false);
    try {
      const [profile, earningsData, activeRideData] = await Promise.all([
        driverApi.getMyProfile(token),
        driverApi.getEarnings(token),
        driverApi.getActiveRide(token),
      ]);
      setDriverStatus(profile.status);
      setDriverId(profile.id);
      setIsOnline(profile.isAvailable);
      setRatingAvg(profile.ratingAvg);
      setTotalRides(profile.totalRides);
      setDriverName(profile.user.name ?? '');
      setEarnings({
        today: earningsData.today,
        thisWeek: earningsData.thisWeek,
        thisMonth: earningsData.thisMonth,
      });
      setActiveRide(activeRideData.booking);
    } catch {
      setLoadError(true);
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les données.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Socket: écoute des demandes de course ─────────────────────────────────
  useEffect(() => {
    if (driverStatus !== 'approved' || !driverId) return;

    const socket = socketService.connect(token);
    socketService.joinDriverRoom(driverId); // ← driverId du profil, pas le JWT

    socket.on('booking:new_request', (ride: RideRequest) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.push({ pathname: '/(tabs)/ride-request', params: { rideJson: JSON.stringify(ride) } });
    });

    socket.on('booking:cancelled', () => {
      setActiveRide(null);
      Toast.show({ type: 'info', text1: 'Course annulée', text2: 'Le passager a annulé la course.' });
    });

    return () => {
      socket.off('booking:new_request');
      socket.off('booking:cancelled');
    };
  }, [driverStatus, driverId, token]);

  // ── Reconnexion socket au retour en foreground ────────────────────────────
  useEffect(() => {
    if (driverStatus !== 'approved' || !driverId) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        socketService.connect(token);
        socketService.joinDriverRoom(driverId);
      }
    });

    return () => sub.remove();
  }, [driverStatus, driverId, token]);

  // ── Location tracking ─────────────────────────────────────────────────────
  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission refusée', text2: 'Activez la localisation pour être en ligne.' });
      return;
    }

    const sendLocation = async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await driverApi.updateLocation(token, loc.coords.latitude, loc.coords.longitude);
      } catch { /* silencieux */ }
    };

    await sendLocation();
    locationTimerRef.current = setInterval(sendLocation, DRIVER_LOCATION_UPDATE_INTERVAL_MS);
  }, [token]);

  const stopLocationTracking = useCallback(() => {
    if (locationTimerRef.current) {
      clearInterval(locationTimerRef.current);
      locationTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopLocationTracking();
  }, [stopLocationTracking]);

  // ── Toggle online ─────────────────────────────────────────────────────────
  const doToggleOnline = async (value: boolean) => {
    setTogglingOnline(true);
    try {
      await driverApi.toggleAvailability(token, value);
      setIsOnline(value);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (value) {
        await startLocationTracking();
        Toast.show({ type: 'success', text1: 'Vous êtes en ligne', text2: 'Vous recevrez les demandes de course.' });
      } else {
        stopLocationTracking();
        Toast.show({ type: 'info', text1: 'Vous êtes hors ligne' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de changer le statut.' });
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleToggleOnline = (value: boolean) => {
    if (driverStatus !== 'approved') {
      Toast.show({ type: 'error', text1: 'Compte non approuvé', text2: 'Attendez la validation de votre dossier.' });
      return;
    }
    if (!value) {
      Alert.alert(
        'Passer hors ligne ?',
        'Vous ne recevrez plus de courses.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Confirmer', onPress: () => doToggleOnline(false) },
        ],
      );
    } else {
      doToggleOnline(true);
    }
  };

  // ── Ride actions ──────────────────────────────────────────────────────────

  /** Étape 1 : chauffeur arrivé à l'aéroport → notifie le passager */
  const handleNotifyArrival = async () => {
    if (!activeRide) return;
    setRideActionLoading(true);
    try {
      await driverApi.notifyArrival(token, activeRide.id);
      setActiveRide({ ...activeRide, status: 'arrived_at_airport' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Passager notifié', text2: 'Le passager sait que vous êtes là.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: "Impossible d'envoyer la notification." });
    } finally {
      setRideActionLoading(false);
    }
  };

  /** Étape 2 : passager à bord → démarre la course */
  const handleStartRide = async () => {
    if (!activeRide) return;
    setRideActionLoading(true);
    try {
      await driverApi.startRide(token, activeRide.id);
      setActiveRide({ ...activeRide, status: 'in_progress' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Course démarrée !' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de démarrer la course.' });
    } finally {
      setRideActionLoading(false);
    }
  };

  /** Étape 3 : terminer la course */
  const handleCompleteRide = () => {
    Alert.alert(
      'Terminer la course ?',
      'Confirmez que vous avez déposé le passager à destination.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer',
          onPress: async () => {
            if (!activeRide) return;
            // Capturer les IDs AVANT toute mutation d'état
            const rideId = activeRide.id;
            const passengerId = activeRide.passengerId;
            setRideActionLoading(true);
            try {
              await driverApi.completeRide(token, rideId);
              setActiveRide(null);
              await loadData();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Toast.show({ type: 'success', text1: 'Course terminée !', text2: 'Vous pouvez noter le passager.' });
              router.push({ pathname: '/(tabs)/rate-passenger', params: { passengerId, bookingId: rideId } });
            } catch {
              Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de terminer la course.' });
            } finally {
              setRideActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleNavigate = () => {
    if (!activeRide) return;
    const dest = encodeURIComponent(activeRide.destination);
    Linking.openURL(`https://maps.google.com/?daddr=${dest}`).catch(() => {
      Toast.show({ type: 'error', text1: 'Impossible d\'ouvrir Maps' });
    });
  };

  const handleChat = () => {
    if (!activeRide) return;
    router.push({ pathname: '/(tabs)/chat', params: { passengerId: activeRide.passengerId } });
  };

  const handleCall = () => {
    if (!activeRide?.passengerPhone) return;
    Linking.openURL(`tel:${activeRide.passengerPhone}`);
  };

  // ── DEV: simulate ride request ────────────────────────────────────────────
  const handleSimulateRide = () => {
    const mockRide = driverApi.getMockRideRequest();
    router.push({ pathname: '/(tabs)/ride-request', params: { rideJson: JSON.stringify(mockRide) } });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <AlertCircle size={40} color={COLORS.error} />
          <Text style={styles.errorStateText}>Impossible de charger les données.</Text>
          <Pressable style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour{driverName ? `, ${driverName.split(' ')[0]}` : ''} 👋</Text>
            <View style={styles.statsRow}>
              <Star size={14} color={COLORS.accent} fill={COLORS.accent} />
              <Text style={styles.statText}>{ratingAvg.toFixed(1)}</Text>
              <Text style={styles.statDot}>·</Text>
              <Text style={styles.statText}>{totalRides} courses</Text>
            </View>
          </View>

          {/* Online toggle */}
          <View style={styles.onlineToggle}>
            {togglingOnline ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                {isOnline
                  ? <Wifi size={18} color={COLORS.success} />
                  : <WifiOff size={18} color={COLORS.grayMedium} />
                }
                <Switch
                  value={isOnline}
                  onValueChange={handleToggleOnline}
                  trackColor={{ false: COLORS.grayLight, true: `${COLORS.success}55` }}
                  thumbColor={isOnline ? COLORS.success : COLORS.grayMedium}
                  style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                />
              </>
            )}
          </View>
        </View>

        {/* Status banner */}
        <StatusBanner status={driverStatus} />

        {/* Online/offline pill */}
        <View style={[styles.onlinePill, isOnline ? styles.onlinePillActive : styles.onlinePillInactive]}>
          <View style={[styles.dot, { backgroundColor: isOnline ? COLORS.success : COLORS.grayMedium }]} />
          <Text style={[styles.onlinePillText, { color: isOnline ? COLORS.success : COLORS.grayMedium }]}>
            {isOnline ? 'En ligne — vous recevez des courses' : 'Hors ligne'}
          </Text>
        </View>

        {/* Active ride */}
        {activeRide && (
          <ActiveRideCard
            ride={activeRide}
            onArrival={handleNotifyArrival}
            onStart={handleStartRide}
            onComplete={handleCompleteRide}
            onNavigate={handleNavigate}
            onChat={handleChat}
            onCall={handleCall}
            loading={rideActionLoading}
          />
        )}

        {/* Empty state: no active ride + approved */}
        {!activeRide && driverStatus === 'approved' && isOnline && (
          <View style={styles.emptyState}>
            <Car size={36} color={COLORS.grayMedium} />
            <Text style={styles.emptyStateText}>En attente de courses...</Text>
            <Text style={styles.emptyStateSubtext}>Vous recevrez une notification dès qu'un passager vous sélectionne.</Text>
          </View>
        )}

        {/* Earnings */}
        <EarningsCard
          today={earnings.today}
          thisWeek={earnings.thisWeek}
          thisMonth={earnings.thisMonth}
        />

        {/* Quick links */}
        <View style={styles.quickLinks}>
          <Pressable style={styles.quickLink} onPress={() => router.push('/(tabs)/conversations')}>
            <MessageCircle size={20} color={COLORS.primary} />
            <Text style={styles.quickLinkText}>Messages</Text>
            <ChevronRight size={16} color={COLORS.grayMedium} />
          </Pressable>
          <View style={styles.quickLinkDivider} />
          <Pressable style={styles.quickLink} onPress={() => router.push('/(tabs)/status')}>
            <AlertCircle size={20} color={COLORS.primary} />
            <Text style={styles.quickLinkText}>Statut du dossier</Text>
            <ChevronRight size={16} color={COLORS.grayMedium} />
          </Pressable>
        </View>

        {/* DEV button */}
        {IS_DEV && (
          <Pressable style={styles.devBtn} onPress={handleSimulateRide}>
            <Text style={styles.devBtnText}>🧪 Simuler une demande de course</Text>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  greeting: { fontSize: 20, fontWeight: '800', color: COLORS.black },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statText: { fontSize: 13, color: COLORS.grayDark, fontWeight: '500' },
  statDot: { fontSize: 13, color: COLORS.grayMedium },

  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  statusBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: BORDER_RADIUS.card, padding: SPACING.sm, marginBottom: SPACING.sm },
  statusBannerText: { flex: 1, fontSize: 13, color: COLORS.grayDark, lineHeight: 18 },

  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 30, paddingHorizontal: 14, paddingVertical: 8, marginBottom: SPACING.md, alignSelf: 'flex-start' },
  onlinePillActive: { backgroundColor: '#E8F8EE' },
  onlinePillInactive: { backgroundColor: COLORS.grayLight },
  onlinePillText: { fontSize: 13, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Active ride card
  activeRideCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: `${COLORS.primary}22` },
  activeRideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  activeRideBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeRideBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.grayDark },
  activeRidePrice: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  activeRideRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  activeRideDestination: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.black },
  activeRideSubtext: { fontSize: 13, color: COLORS.grayMedium },
  activeRidePassenger: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  activeRideAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${COLORS.primary}22`, alignItems: 'center', justifyContent: 'center' },
  activeRideAvatarText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  activeRidePassengerName: { fontSize: 14, fontWeight: '600', color: COLORS.black, flex: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  activeRideActions: { marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: BORDER_RADIUS.button, paddingVertical: 14 },
  actionBtnArrival: { backgroundColor: '#2196F3' },
  actionBtnStart: { backgroundColor: COLORS.primary },
  actionBtnComplete: { backgroundColor: COLORS.success },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  // Earnings
  earningsCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card, padding: SPACING.md, marginBottom: SPACING.md },
  earningsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  earningsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.black },
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
  earningsStat: { flex: 1, alignItems: 'center' },
  earningsAmount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  earningsLabel: { fontSize: 11, color: COLORS.grayMedium, marginTop: 2 },
  earningsDivider: { width: 1, height: 36, backgroundColor: COLORS.grayLight },

  // Quick links
  quickLinks: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card, marginBottom: SPACING.md, overflow: 'hidden' },
  quickLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  quickLinkText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.black },
  quickLinkDivider: { height: 1, backgroundColor: COLORS.grayLight, marginHorizontal: SPACING.md },

  // Dev
  devBtn: { backgroundColor: '#F0E6FF', borderRadius: BORDER_RADIUS.button, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm },
  devBtnText: { fontSize: 13, fontWeight: '600', color: '#6B21A8' },

  // Error state
  errorStateText: { fontSize: 15, color: COLORS.grayDark, marginTop: SPACING.sm, textAlign: 'center' },
  retryBtn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button, paddingVertical: 12, paddingHorizontal: 28 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // Empty state
  emptyState: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.card, padding: SPACING.lg, marginBottom: SPACING.md, alignItems: 'center', gap: 8 },
  emptyStateText: { fontSize: 16, fontWeight: '700', color: COLORS.grayDark },
  emptyStateSubtext: { fontSize: 13, color: COLORS.grayMedium, textAlign: 'center', lineHeight: 18 },
});
