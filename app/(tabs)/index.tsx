import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, Switch, Platform, Linking, AppState,
  Modal, TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Haptics from 'expo-haptics';
import { LOCATION_TASK_NAME } from '../../tasks/locationTask';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wifi, WifiOff, MapPin, Star, TrendingUp,
  Clock, Car, Phone, MessageCircle, Play, CheckCircle,
  AlertCircle, ChevronRight, Navigation, Plane, AlertTriangle, Banknote,
} from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, BORDER_RADIUS, DRIVER_LOCATION_UPDATE_INTERVAL_MS, formatCurrency } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDriverConfigStore } from '../../stores/configStore';
import { driverApi, type RideRequest, type ActiveRide, type DriverStatus, type FlightStatus } from '../../services/api';
import { socketService } from '../../services/socket';
import { chatSocket } from '../../services/chatSocket';
import { useChatStore } from '../../stores/chatStore';
import { useThemeStore } from '../../stores/themeStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

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

// ── Flight info card ──────────────────────────────────────────────────────────
function FlightInfoCard({ flightNumber, flightStatus, airport }: {
  flightNumber: string;
  flightStatus: FlightStatus | null;
  airport: string;
}) {
  const { isDark } = useThemeStore();
  const cardBg = isDark ? '#0F172A' : '#F0F9FF';
  const textColor = isDark ? '#F1F5F9' : COLORS.black;
  const subColor = isDark ? '#94A3B8' : COLORS.grayMedium;

  const statusConfig = flightStatus ? {
    landed:  { label: 'Atterri ✅',      bg: '#E8F5E9', text: '#2E7D32', border: '#4CAF50' },
    delayed: { label: 'Atterri 🛬',      bg: '#FFF8E1', text: '#E65100', border: '#FF9800' },
    on_time: { label: 'À l\'heure 🟢',   bg: '#E3F2FD', text: '#1565C0', border: '#2196F3' },
  }[flightStatus.status] : null;

  const scheduledTime = flightStatus
    ? new Date(flightStatus.scheduledArrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const formatCountdown = (minutes: number) => {
    if (minutes <= 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
  };

  return (
    <View style={[flightStyles.card, { backgroundColor: cardBg }]}>
      <View style={flightStyles.header}>
        <Plane size={16} color={COLORS.primary} />
        <Text style={[flightStyles.flightNum, { color: textColor }]}>
          {flightStatus?.airline ? `${flightStatus.airline} · ` : ''}{flightNumber}
        </Text>
        <Text style={[flightStyles.airport, { color: subColor }]}>· {airport}</Text>
        {statusConfig && (
          <View style={[flightStyles.badge, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
            <Text style={[flightStyles.badgeText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
          </View>
        )}
      </View>

      {flightStatus && (
        <View style={flightStyles.row}>
          <View style={flightStyles.infoBlock}>
            <Text style={[flightStyles.infoLabel, { color: subColor }]}>Atterrissage prévu</Text>
            <Text style={[flightStyles.infoValue, { color: textColor }]}>{scheduledTime ?? '—'}</Text>
          </View>
          {flightStatus.status !== 'landed' && (
            <View style={flightStyles.infoBlock}>
              <Text style={[flightStyles.infoLabel, { color: subColor }]}>Temps restant</Text>
              <Text style={[flightStyles.infoValue, { color: COLORS.primary }]}>
                {formatCountdown(flightStatus.minutesUntilLanding)}
              </Text>
            </View>
          )}
          {flightStatus.status === 'landed' && (
            <View style={flightStyles.infoBlock}>
              <Text style={[flightStyles.infoLabel, { color: subColor }]}>Le passager arrive</Text>
              <Text style={[flightStyles.infoValue, { color: '#2E7D32' }]}>~10–15 min</Text>
            </View>
          )}
        </View>
      )}

      {!flightStatus && (
        <Text style={[flightStyles.noData, { color: subColor }]}>Statut du vol non disponible</Text>
      )}

      <Pressable
        style={flightStyles.detailsBtn}
        onPress={() => router.push({ pathname: '/(tabs)/flight-details', params: { flightNumber } } as never)}
      >
        <Text style={flightStyles.detailsBtnText}>Voir tous les détails du vol →</Text>
      </Pressable>
    </View>
  );
}

const flightStyles = StyleSheet.create({
  card: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  flightNum: { fontSize: 15, fontWeight: '700' },
  airport: { fontSize: 13, flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 24 },
  infoBlock: { gap: 2 },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 18, fontWeight: '800' },
  noData: { fontSize: 13, fontStyle: 'italic' },
  detailsBtn: { marginTop: 10, alignSelf: 'flex-start' },
  detailsBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});

// ── Active ride card ──────────────────────────────────────────────────────────
function ActiveRideCard({
  ride,
  onArrival,
  onStart,
  onComplete,
  onNavigate,
  onChat,
  onCall,
  onBreakdown,
  loading,
  chatUnread = 0,
  featChat = true,
  featBreakdown = true,
}: {
  ride: ActiveRide;
  onArrival: () => void;
  onStart: () => void;
  onComplete: () => void;
  onNavigate: () => void;
  onChat: () => void;
  onCall: () => void;
  onBreakdown: () => void;
  loading: boolean;
  chatUnread?: number;
  featChat?: boolean;
  featBreakdown?: boolean;
}) {
  const isDeparture = ride.type === 'DEPARTURE';
  const { isDark } = useThemeStore();
  const cardBg = isDark ? '#1E293B' : COLORS.white;
  const textColor = isDark ? '#F1F5F9' : COLORS.black;
  const subTextColor = isDark ? '#94A3B8' : COLORS.grayMedium;
  const iconBg = isDark ? '#0F172A' : COLORS.background;

  // Timer d'attente au statut arrived_at_airport
  const [waitSeconds, setWaitSeconds] = useState(0);
  useEffect(() => {
    if (ride.status !== 'arrived_at_airport') { setWaitSeconds(0); return; }
    const t = setInterval(() => setWaitSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [ride.status]);

  const formatWait = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const pricingLabel = 'Zone';

  // ── État : confirmed ──────────────────────────────────────────────────────
  if (ride.status === 'confirmed') {
    return (
      <View style={[styles.activeRideCard, { backgroundColor: cardBg }]}>
        {/* Header */}
        <View style={styles.arcHeader}>
          <View>
            <Text style={[styles.arcTitle, { color: textColor }]}>
              {isDeparture ? 'Vers le passager' : 'Vers le point de prise'}
            </Text>
            <Text style={[styles.arcSubtitle, { color: subTextColor }]}>
              {isDeparture ? ride.pickupAddress ?? ride.departureAirport : ride.departureAirport}
            </Text>
          </View>
          {ride.durationMin != null && (
            <View style={styles.etaBadge}>
              <Clock size={11} color={COLORS.success} />
              <Text style={styles.etaText}>Eta {ride.durationMin} min</Text>
            </View>
          )}
        </View>

        {/* Route box */}
        <View style={[styles.routeBox, { backgroundColor: isDark ? '#0F172A' : COLORS.background }]}>
          <View style={styles.routeStop}>
            <View style={styles.routeDotGreen} />
            <Text style={[styles.routeStopText, { color: textColor }]} numberOfLines={1}>
              {ride.departureAirport}
            </Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: isDark ? '#334155' : COLORS.grayLight }]} />
          <View style={styles.routeStop}>
            <View style={styles.routeDotNavy} />
            <Text style={[styles.routeStopText, { color: textColor }]} numberOfLines={1}>
              {ride.destination}
            </Text>
          </View>
        </View>

        {/* 3 colonnes */}
        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <Text style={[styles.statColValue, { color: textColor }]}>
              {ride.distanceKm != null ? `${ride.distanceKm} km` : '—'}
            </Text>
            <Text style={[styles.statColLabel, { color: subTextColor }]}>Distance</Text>
          </View>
          <View style={[styles.statColDivider, { backgroundColor: isDark ? '#334155' : COLORS.grayLight }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statColValue, { color: textColor }]}>
              {ride.durationMin != null ? `${ride.durationMin} min` : '—'}
            </Text>
            <Text style={[styles.statColLabel, { color: subTextColor }]}>Durée</Text>
          </View>
          <View style={[styles.statColDivider, { backgroundColor: isDark ? '#334155' : COLORS.grayLight }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statColValue, { color: textColor }]}>{pricingLabel}</Text>
            <Text style={[styles.statColLabel, { color: subTextColor }]}>Type</Text>
          </View>
        </View>

        {/* Vol */}
        {ride.flightNumber && (
          <FlightInfoCard flightNumber={ride.flightNumber} flightStatus={ride.flightStatus ?? null} airport={ride.departureAirport} />
        )}

        {/* Passager + actions rapides */}
        <View style={styles.arcPassengerRow}>
          {ride.passengerAvatarUrl
            ? <View style={styles.arcAvatarWrap}><View style={[styles.activeRideAvatarPlaceholder, { backgroundColor: `${COLORS.primary}22` }]}><Text style={styles.activeRideAvatarText}>{(ride.passengerName ?? '?')[0].toUpperCase()}</Text></View></View>
            : <View style={styles.activeRideAvatarPlaceholder}><Text style={styles.activeRideAvatarText}>{(ride.passengerName ?? '?')[0].toUpperCase()}</Text></View>
          }
          <Text style={[styles.activeRidePassengerName, { color: textColor }]} numberOfLines={1}>
            {ride.passengerName ?? 'Passager'}
          </Text>
          <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onNavigate}><Navigation size={18} color={COLORS.primary} /></Pressable>
          {featChat && (
            <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onChat}>
              <View style={{ position: 'relative' }}>
                <MessageCircle size={18} color={COLORS.primary} />
                {chatUnread > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          {ride.id && <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onCall}><Phone size={18} color={COLORS.success} /></Pressable>}
        </View>

        {/* Boutons */}
        <Pressable style={[styles.arcPrimaryBtn, styles.arcBtnArrival]} onPress={onArrival} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
            <>
              <MapPin size={16} color={COLORS.white} />
              <Text style={styles.arcPrimaryBtnText}>
                {isDeparture ? 'Je suis chez le passager' : 'Je suis arrivé'}
              </Text>
            </>
          )}
        </Pressable>
        {featBreakdown && (
          <Pressable style={styles.arcOutlineBtn} onPress={onBreakdown} disabled={loading}>
            <Text style={styles.arcOutlineBtnText}>Annuler</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── État : arrived_at_airport ─────────────────────────────────────────────
  if (ride.status === 'arrived_at_airport') {
    return (
      <View style={[styles.activeRideCard, { backgroundColor: cardBg }]}>
        {/* Badge + titre */}
        <View style={styles.arcHeader}>
          <View>
            <View style={styles.waitBadge}>
              <Text style={styles.waitBadgeText}>En attente</Text>
            </View>
            <Text style={[styles.arcTitle, { color: textColor, marginTop: 6 }]}>
              {isDeparture ? 'Attente passager' : 'En attente du client'}
            </Text>
          </View>
          <View style={styles.notifiedBadge}>
            <CheckCircle size={12} color={COLORS.success} />
            <Text style={styles.notifiedText}>Notifié</Text>
          </View>
        </View>

        {/* 3 colonnes avec timer */}
        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <View style={styles.statColTimerRow}>
              <Clock size={13} color={COLORS.warning} />
              <Text style={[styles.statColValue, { color: COLORS.warning }]}>{formatWait(waitSeconds)}</Text>
            </View>
            <Text style={[styles.statColLabel, { color: subTextColor }]}>Attente</Text>
          </View>
          <View style={[styles.statColDivider, { backgroundColor: isDark ? '#334155' : COLORS.grayLight }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statColValue, { color: textColor }]}>
              {ride.distanceKm != null ? `${ride.distanceKm} km` : '—'}
            </Text>
            <Text style={[styles.statColLabel, { color: subTextColor }]}>Distance</Text>
          </View>
          <View style={[styles.statColDivider, { backgroundColor: isDark ? '#334155' : COLORS.grayLight }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statColValue, { color: textColor }]}>{pricingLabel}</Text>
            <Text style={[styles.statColLabel, { color: subTextColor }]}>Type</Text>
          </View>
        </View>

        {/* Vol */}
        {ride.flightNumber && (
          <FlightInfoCard flightNumber={ride.flightNumber} flightStatus={ride.flightStatus ?? null} airport={ride.departureAirport} />
        )}

        {/* Passager */}
        <View style={styles.arcPassengerRow}>
          <View style={styles.activeRideAvatarPlaceholder}>
            <Text style={styles.activeRideAvatarText}>{(ride.passengerName ?? '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={[styles.activeRidePassengerName, { color: textColor }]} numberOfLines={1}>
            {ride.passengerName ?? 'Passager'}
          </Text>
          <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onNavigate}><Navigation size={18} color={COLORS.primary} /></Pressable>
          {featChat && (
            <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onChat}>
              <View style={{ position: 'relative' }}>
                <MessageCircle size={18} color={COLORS.primary} />
                {chatUnread > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          {ride.id && <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onCall}><Phone size={18} color={COLORS.success} /></Pressable>}
        </View>

        {/* Boutons */}
        <Pressable style={[styles.arcPrimaryBtn, { backgroundColor: COLORS.primary }]} onPress={onStart} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
            <>
              <Play size={16} color={COLORS.white} />
              <Text style={styles.arcPrimaryBtnText}>Démarrer la course</Text>
            </>
          )}
        </Pressable>
        {featBreakdown && (
          <Pressable style={styles.arcOutlineBtn} onPress={onBreakdown} disabled={loading}>
            <Text style={styles.arcOutlineBtnText}>Annuler</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── État : in_progress (et passenger_confirming/completed) ────────────────
  return (
    <View style={[styles.activeRideCard, { backgroundColor: cardBg }]}>
      {/* Badge + titre + barre progression */}
      <View style={styles.arcHeader}>
        <View>
          <View style={styles.inProgressBadge}>
            <Text style={styles.inProgressBadgeText}>Course en cours</Text>
          </View>
          <Text style={[styles.arcTitle, { color: textColor, marginTop: 6 }]}>Trajet en cours</Text>
        </View>
        <Text style={styles.arcPrice}>{formatCurrency(ride.estimatedPrice)}</Text>
      </View>

      {/* Barre progression */}
      <View style={styles.progressBarTrack}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.progressBarFill} />
      </View>

      {/* Passager simplifié */}
      <View style={styles.arcPassengerRow}>
        <View style={styles.activeRideAvatarPlaceholder}>
          <Text style={styles.activeRideAvatarText}>{(ride.passengerName ?? '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={[styles.activeRidePassengerName, { color: textColor }]} numberOfLines={1}>
          {ride.passengerName ?? 'Passager'}
        </Text>
        <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onNavigate}><Navigation size={18} color={COLORS.primary} /></Pressable>
        {featChat && <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onChat}><MessageCircle size={18} color={COLORS.primary} /></Pressable>}
        {ride.passengerPhone && <Pressable style={[styles.iconBtn, { backgroundColor: iconBg }]} onPress={onCall}><Phone size={18} color={COLORS.success} /></Pressable>}
      </View>

      {/* Boutons */}
      <View style={styles.inProgressActions}>
        {featBreakdown && (
          <Pressable style={[styles.actionBtn, styles.actionBtnProblem, { flex: 1 }]} onPress={onBreakdown} disabled={loading}>
            <AlertTriangle size={16} color={COLORS.error} />
            <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Problème</Text>
          </Pressable>
        )}
        <Pressable style={[styles.actionBtn, styles.actionBtnComplete, { flex: 2 }]} onPress={onComplete} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
            <>
              <CheckCircle size={16} color={COLORS.white} />
              <Text style={styles.actionBtnText}>Terminer</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Daily goals card ──────────────────────────────────────────────────────────
type DailyGoalsData = {
  goals:    { rides: number; earnings: number; rating: number };
  progress: { rides: number; earnings: number; rating: number };
  pct:      { rides: number; earnings: number; rating: number };
  achieved: { rides: boolean; earnings: boolean; rating: boolean };
};

function DailyGoalsCard({ data, cardBg, textColor, subTextColor }: {
  data: DailyGoalsData; cardBg: string; textColor: string; subTextColor: string;
}) {
  const items = [
    { key: 'rides',    label: 'Courses',    emoji: '🚗', value: `${data.progress.rides}/${data.goals.rides}`,              pct: data.pct.rides,    done: data.achieved.rides },
    { key: 'earnings', label: 'Gains',      emoji: '💰', value: `${data.progress.earnings.toLocaleString()}/${data.goals.earnings.toLocaleString()} F`, pct: data.pct.earnings, done: data.achieved.earnings },
    { key: 'rating',   label: 'Note',       emoji: '⭐', value: `${data.progress.rating}/${data.goals.rating}`,            pct: data.pct.rating,   done: data.achieved.rating },
  ];
  const doneCount = [data.achieved.rides, data.achieved.earnings, data.achieved.rating].filter(Boolean).length;

  return (
    <View style={[styles.goalsCard, { backgroundColor: cardBg }]}>
      <View style={styles.goalsHeader}>
        <Text style={styles.goalsEmoji}>🎯</Text>
        <Text style={[styles.goalsTitle, { color: textColor }]}>Objectifs du jour</Text>
        <View style={[styles.goalsBadge, { backgroundColor: doneCount === 3 ? '#4CAF5020' : COLORS.background }]}>
          <Text style={[styles.goalsBadgeText, { color: doneCount === 3 ? '#4CAF50' : COLORS.grayMedium }]}>
            {doneCount}/3
          </Text>
        </View>
      </View>
      {items.map(item => (
        <View key={item.key} style={styles.goalRow}>
          <Text style={styles.goalEmoji}>{item.emoji}</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.goalLabelRow}>
              <Text style={[styles.goalLabel, { color: textColor }]}>{item.label}</Text>
              <Text style={[styles.goalValue, { color: item.done ? '#4CAF50' : subTextColor }]}>{item.value}</Text>
            </View>
            <View style={[styles.goalTrack, { backgroundColor: COLORS.grayLight }]}>
              <View style={[styles.goalFill, { width: `${item.pct}%` as any, backgroundColor: item.done ? '#4CAF50' : COLORS.primary }]} />
            </View>
          </View>
          {item.done && <Text style={styles.goalDone}>✓</Text>}
        </View>
      ))}
    </View>
  );
}

// ── Earnings card ─────────────────────────────────────────────────────────────
function EarningsCard({ today, thisWeek, thisMonth, walletBalance, cardBg, textColor, subTextColor, borderColor }: {
  today: number; thisWeek: number; thisMonth: number; walletBalance: number;
  cardBg: string; textColor: string; subTextColor: string; borderColor: string;
}) {
  return (
    <View style={[styles.earningsCard, { backgroundColor: cardBg }]}>
      <View style={styles.earningsHeader}>
        <TrendingUp size={18} color={COLORS.primary} />
        <Text style={[styles.earningsTitle, { color: textColor }]}>Mes gains</Text>
      </View>
      <View style={styles.earningsRow}>
        <View style={styles.earningsStat}>
          <Text style={styles.earningsAmount}>{formatCurrency(today)}</Text>
          <Text style={[styles.earningsLabel, { color: subTextColor }]}>Aujourd'hui</Text>
        </View>
        <View style={[styles.earningsDivider, { backgroundColor: borderColor }]} />
        <View style={styles.earningsStat}>
          <Text style={styles.earningsAmount}>{formatCurrency(thisWeek)}</Text>
          <Text style={[styles.earningsLabel, { color: subTextColor }]}>Cette semaine</Text>
        </View>
        <View style={[styles.earningsDivider, { backgroundColor: borderColor }]} />
        <View style={styles.earningsStat}>
          <Text style={styles.earningsAmount}>{formatCurrency(thisMonth)}</Text>
          <Text style={[styles.earningsLabel, { color: subTextColor }]}>Ce mois</Text>
        </View>
        <View style={[styles.earningsDivider, { backgroundColor: borderColor }]} />
        <View style={[styles.earningsStat, { backgroundColor: `${COLORS.primary}10`, borderRadius: 8, padding: 4 }]}>
          <Text style={[styles.earningsAmount, { color: COLORS.success }]}>{formatCurrency(walletBalance)}</Text>
          <Text style={[styles.earningsLabel, { color: subTextColor, fontWeight: '700' }]}>Portefeuille</Text>
        </View>
      </View>
      <Pressable
        style={styles.withdrawBtn}
        onPress={() => router.push('/(tabs)/withdraw' as never)}
      >
        <Banknote size={16} color={COLORS.white} />
        <Text style={styles.withdrawBtnText}>Retirer mes gains</Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const token = useAuthStore((s) => s.token)!;
  const authUser = useAuthStore((s) => s.user);
  const { isDark } = useThemeStore();
  const getSetting = useDriverConfigStore((s) => s.getSetting);
  const isFeatureEnabled = useDriverConfigStore((s) => s.isFeatureEnabled);
  const featChat      = isFeatureEnabled('feature_chat_enabled');
  const featBreakdown = isFeatureEnabled('feature_breakdown_report_enabled');
  const { networkQuality } = useNetworkStatus();
  const params = useLocalSearchParams<{ immediateRide?: string; wakeUp?: string; bookingId?: string; clearRequest?: string }>();

  const bg = isDark ? '#0F172A' : COLORS.background;
  const cardBg = isDark ? '#1E293B' : COLORS.white;
  const textColor = isDark ? '#F1F5F9' : COLORS.black;
  const subTextColor = isDark ? '#94A3B8' : COLORS.grayMedium;
  const borderColor = isDark ? '#334155' : COLORS.grayLight;

  const [driverStatus, setDriverStatus] = useState<DriverStatus>('pending');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [totalRides, setTotalRides] = useState(0);
  const [driverName, setDriverName] = useState(authUser?.name ?? '');
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const chatHandlerRef = useRef<((msg: any) => void) | null>(null);
  const chatConvIdRef = useRef<string | null>(null);
  const { incrementBooking, resetBooking, bookingUnread } = useChatStore();
  const chatUnread = activeRide ? (bookingUnread[activeRide.id] ?? 0) : 0;
  const [reputationScore, setReputationScore] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [earnings, setEarnings] = useState({ today: 0, thisWeek: 0, thisMonth: 0, walletBalance: 0 });
  const [dailyGoals, setDailyGoals] = useState<DailyGoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [rideActionLoading, setRideActionLoading] = useState(false);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [destChangeRequest, setDestChangeRequest] = useState<{
    bookingId: string;
    oldDestination: string;
    newDestination: string;
    oldPrice: number;
    newPrice: number;
    priceDiff: number;
    countdown: number;
  } | null>(null);
  const [destChangeResponding, setDestChangeResponding] = useState(false);
  const destChangeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showingRequestIdRef = useRef<string | null>(null);

  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Réveil par notification FCM → inciter à se mettre en ligne ───────────
  useEffect(() => {
    if (params.wakeUp !== 'true') return;
    // Petit délai pour que l'UI soit montée
    const t = setTimeout(() => {
      if (!isOnline) {
        Toast.show({
          type: 'info',
          text1: 'Course en attente 🔔',
          text2: 'Activez "En ligne" pour accepter la course.',
          visibilityTime: 6000,
        });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [params.wakeUp]);

  // ── Nettoyage ref après retour de ride-request ────────────────────────────
  useEffect(() => {
    if (params.clearRequest && showingRequestIdRef.current === params.clearRequest) {
      showingRequestIdRef.current = null;
    }
  }, [params.clearRequest]);

  // ── Course acceptée : affichage immédiat + refresh arrière-plan ───────────
  useEffect(() => {
    if (!params.immediateRide) return;
    try {
      setActiveRide(JSON.parse(params.immediateRide) as ActiveRide);
      // Refresh en arrière-plan pour récupérer téléphone + statut vol
      driverApi.getActiveRide(token).then(({ booking }) => {
        if (booking) setActiveRide(booking);
      }).catch(() => {});
    } catch { /* JSON invalide */ }
  }, [params.immediateRide]);

  // ── Load initial data ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadError(false);
    try {
      // Le profil est critique — si ça échoue, on affiche l'erreur
      const profile = await driverApi.getMyProfile(token);
      setDriverStatus(profile.status);
      setDriverId(profile.id);
      setIsOnline(profile.isAvailable);
      setRatingAvg(profile.ratingAvg ?? 0);
      setTotalRides(profile.totalRides ?? 0);
      setReputationScore(profile.reputationScore ?? 0);
      setWalletBalance(profile.walletBalance ?? 0);
      setDriverName(profile.user.name ?? '');

      // Les gains et la course active sont non-critiques
      const results = await Promise.allSettled([
        driverApi.getEarnings(token),
        driverApi.getActiveRide(token),
        driverApi.getDailyGoalsProgress(token),
      ]);

      const earningsRes = results[0];
      const activeRideRes = results[1];
      const goalsRes = results[2];

      if (earningsRes.status === 'fulfilled') {
        const val = earningsRes.value as any;
        setEarnings({
          today: val.today ?? 0,
          thisWeek: val.thisWeek ?? 0,
          thisMonth: val.thisMonth ?? 0,
          walletBalance: val.walletBalance ?? 0,
        });
        setWalletBalance(val.walletBalance ?? 0);
      }
      if (activeRideRes.status === 'fulfilled') {
        setActiveRide(activeRideRes.value.booking);
      }
      if (goalsRes.status === 'fulfilled' && goalsRes.value) {
        setDailyGoals(goalsRes.value as DailyGoalsData);
      }
    } catch (err: any) {
      // 404 = pas encore de profil chauffeur (nouveau compte) → dashboard vide sans erreur
      if (err?.statusCode === 404) {
        setDriverStatus('pending');
      } else {
        console.error('[loadData] Erreur:', err?.message, err?.statusCode);
        setLoadError(true);
        Toast.show({ type: 'error', text1: 'Erreur', text2: err?.message || 'Impossible de charger les données.' });
      }
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
    socketService.joinDriverRoom(driverId);

    const handleNewRequest = (ride: RideRequest) => {
      // Ignorer si cette demande est déjà affichée
      if (showingRequestIdRef.current === ride.id) return;
      showingRequestIdRef.current = ride.id;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // replace au lieu de push — évite l'empilement de screens dans la stack
      router.replace({ pathname: '/(tabs)/ride-request', params: { rideJson: JSON.stringify(ride) } } as never);
    };

    socket.on('booking:new_request', handleNewRequest);

    socket.on('booking:cancelled', () => {
      setActiveRide(null);
      Toast.show({ type: 'info', text1: 'Course annulée', text2: 'Le passager a annulé la course.' });
    });

    socket.on('booking:destination_change_request', (data: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setDestChangeRequest({ ...data, countdown: 60 });
      if (destChangeTimerRef.current) clearInterval(destChangeTimerRef.current);
      destChangeTimerRef.current = setInterval(() => {
        setDestChangeRequest(prev => {
          if (!prev) { clearInterval(destChangeTimerRef.current!); return null; }
          if (prev.countdown <= 1) {
            clearInterval(destChangeTimerRef.current!);
            return null; // expire
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);
    });

    // Rattrapage immédiat au montage
    driverApi.getPendingRequest(token).then(({ booking }) => {
      if (booking) handleNewRequest(booking);
    }).catch(() => {});

    return () => {
      socket.off('booking:new_request');
      socket.off('booking:cancelled');
      socket.off('booking:destination_change_request');
      if (destChangeTimerRef.current) clearInterval(destChangeTimerRef.current);
    };
  }, [driverStatus, driverId, token]);

  // ── Poll périodique : demande en attente + course active ──────────────────
  useEffect(() => {
    if (driverStatus !== 'approved' || !driverId) return;

    const pollPending = async () => {
      try {
        const { booking } = await driverApi.getPendingRequest(token);
        if (booking && showingRequestIdRef.current !== booking.id) {
          showingRequestIdRef.current = booking.id;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.replace({ pathname: '/(tabs)/ride-request', params: { rideJson: JSON.stringify(booking) } } as never);
        }
      } catch { /* silencieux */ }
    };

    const pollActiveRide = async () => {
      try {
        const { booking } = await driverApi.getActiveRide(token);
        setActiveRide(booking);
      } catch { /* silencieux */ }
    };

    // Poll demande en attente toutes les 8s (si pas de course active)
    const pendingTimer = setInterval(() => {
      if (!activeRide) pollPending();
    }, 8_000);

    // Rafraîchit la course active (statut vol, etc.) toutes les 60s
    const rideTimer = setInterval(() => {
      if (activeRide) pollActiveRide();
    }, 60_000);

    return () => {
      clearInterval(pendingTimer);
      clearInterval(rideTimer);
    };
  }, [driverStatus, driverId, token, activeRide]);

  // ── Reconnexion socket au retour en foreground ────────────────────────────
  useEffect(() => {
    if (driverStatus !== 'approved' || !driverId) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isOnline) {
        socketService.connect(token);
        socketService.joinDriverRoom(driverId);
      }
    });

    return () => sub.remove();
  }, [driverStatus, driverId, token, isOnline]);

  // ── Location tracking (foreground + background) ───────────────────────────
  const startLocationTracking = useCallback(async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission refusée', text2: 'Activez la localisation pour être en ligne.' });
      return;
    }

    // Demander la permission arrière-plan (Android uniquement)
    if (Platform.OS === 'android') {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        Toast.show({ type: 'info', text1: 'Localisation arrière-plan', text2: 'Accordez "Toujours autoriser" pour rester en ligne.' });
      }
    }

    // Envoyer la position immédiatement (2 essais : Balanced puis Low)
    for (const accuracy of [Location.Accuracy.Balanced, Location.Accuracy.Low]) {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy, timeInterval: 8000 });
        await driverApi.updateLocation(token, loc.coords.latitude, loc.coords.longitude);
        break;
      } catch { /* essai suivant */ }
    }

    // 1.D1 — Intervalle selon qualité réseau
    const baseIntervalMs = parseInt(getSetting('driver_position_interval_ms', String(DRIVER_LOCATION_UPDATE_INTERVAL_MS)), 10);
    const intervalMs = networkQuality === '2g' ? baseIntervalMs * 2
      : networkQuality === '3g' ? Math.round(baseIntervalMs * 1.5)
      : baseIntervalMs;

    // Arrêter toute tâche existante avant d'en démarrer une nouvelle
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // Démarrer la tâche de fond — envoie la position même app en arrière-plan
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: intervalMs,
      distanceInterval: 50, // envoyer si déplacement > 50m même avant l'intervalle
      foregroundService: {
        notificationTitle: 'AeroCab Chauffeur',
        notificationBody: 'Vous êtes en ligne — réception des courses active',
        notificationColor: '#22C55E',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true, // iOS — indicateur barre de statut
    });
  }, [token, networkQuality, getSetting]);

  const stopLocationTracking = useCallback(async () => {
    // Arrêter l'ancien timer si présent (fallback)
    if (locationTimerRef.current) {
      clearInterval(locationTimerRef.current);
      locationTimerRef.current = null;
    }
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    return () => { stopLocationTracking(); };
  }, [stopLocationTracking]);

  // ── Chat : écoute messages passager → badge sur bouton Message ────────────
  useEffect(() => {
    // Cleanup previous listener before setting up new one
    const prevHandler = chatHandlerRef.current;
    const prevConvId = chatConvIdRef.current;
    if (prevHandler) { chatSocket.off('new_message', prevHandler); chatHandlerRef.current = null; }
    if (prevConvId) { chatSocket.leaveConversation(prevConvId); chatConvIdRef.current = null; }

    if (!activeRide?.id || !token) {
      setActiveConvId(null);
      return;
    }
    const bookingId = activeRide.id;
    const passengerId = activeRide.passengerId;
    let cancelled = false;

    driverApi.getOrCreateConversation(token, passengerId)
      .then((conv: any) => {
        if (cancelled || !conv?.id) return;
        const convId: string = conv.id;
        setActiveConvId(convId);
        chatConvIdRef.current = convId;
        chatSocket.connect(token);
        chatSocket.joinConversation(convId);

        const handler = (msg: any) => {
          if (msg?.senderId !== authUser?.id) { incrementBooking(bookingId); }
        };
        chatHandlerRef.current = handler;
        chatSocket.on('new_message', handler);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      const h = chatHandlerRef.current;
      const c = chatConvIdRef.current;
      if (h) { chatSocket.off('new_message', h); chatHandlerRef.current = null; }
      if (c) { chatSocket.leaveConversation(c); chatConvIdRef.current = null; }
    };
  }, [activeRide?.id, activeRide?.passengerId, token]);

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
        await stopLocationTracking();
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
      setOfflineModalVisible(true);
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

  const handleBreakdown = () => {
    setBreakdownModalVisible(true);
  };

  const confirmBreakdown = async () => {
    setBreakdownModalVisible(false);
    if (!activeRide) return;
    setBreakdownLoading(true);
    try {
      const result = await driverApi.reportBreakdown(token, activeRide.id);
      setActiveRide(null);
      await loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: result.replaced ? 'success' : 'info',
        text1: 'Panne signalée',
        text2: result.replaced
          ? 'Un chauffeur de remplacement a été trouvé.'
          : 'Aucun remplaçant disponible. Course annulée et remboursée.',
        visibilityTime: 5000,
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de signaler la panne.' });
    } finally {
      setBreakdownLoading(false);
    }
  };

  /** Étape 3 : terminer la course */
  const handleCompleteRide = () => {
    setCompleteModalVisible(true);
  };

  const confirmCompleteRide = async () => {
    setCompleteModalVisible(false);
    if (!activeRide) return;
    // Capturer les IDs AVANT toute mutation d'état
    const rideId = activeRide.id;
    const passengerId = activeRide.passengerId;
    setRideActionLoading(true);
    try {
      await driverApi.completeRide(token, rideId);
      // Récupérer la conversation liée au passager
      let conversationId = '';
      try {
        const conversations = await driverApi.getConversations(token) as any[];
        const conv = conversations.find((c: any) => c.passengerId === passengerId || c.passenger?.id === passengerId);
        if (conv) conversationId = conv.id;
      } catch {}
      setActiveRide(null);
      await loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Course terminée !', text2: 'Vous pouvez noter le passager.' });
      router.push({
        pathname: '/(tabs)/rate-passenger',
        params: {
          passengerId,
          bookingId: rideId,
          conversationId,
          passengerName:      activeRide.passengerName ?? '',
          passengerAvatarUrl: activeRide.passengerAvatarUrl ?? '',
          passengerVerified:  String(activeRide.passengerVerified ?? false),
          estimatedPrice:     String(activeRide.estimatedPrice),
          distanceKm:         String(activeRide.distanceKm ?? ''),
          durationMin:        String(activeRide.durationMin ?? ''),
          pricingMode:        activeRide.pricingMode ?? 'kilometrage',
          departureAirport:   activeRide.departureAirport,
          destination:        activeRide.destination,
        },
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de terminer la course.' });
    } finally {
      setRideActionLoading(false);
    }
  };

  const handleNavigate = () => {
    if (!activeRide) return;
    router.push({
      pathname: '/(tabs)/trip-map',
      params: {
        airport: activeRide.departureAirport,
        passengerName: activeRide.passengerName ?? '',
        destination: activeRide.destination,
      },
    } as never);
  };

  const handleChat = () => {
    if (!activeRide) return;
    resetBooking(activeRide.id);
    router.push({
      pathname: '/(tabs)/chat',
      params: {
        passengerId: activeRide.passengerId,
        bookingId: activeRide.id,
        ...(activeConvId ? { conversationId: activeConvId } : {}),
      },
    });
  };

  const handleCall = async () => {
    if (!activeRide?.id || !token) return;
    try {
      const { proxyNumber } = await driverApi.createProxyCall(token, activeRide.id);
      Linking.openURL(`tel:${proxyNumber}`);
    } catch {
      Toast.show({ type: 'error', text1: 'Appel', text2: 'Impossible d\'initier l\'appel' });
    }
  };

  // ── DEV: simulate ride request ────────────────────────────────────────────
  const handleSimulateRide = () => {
    const mockRide = driverApi.getMockRideRequest();
    router.push({ pathname: '/(tabs)/ride-request', params: { rideJson: JSON.stringify(mockRide) } });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <AlertCircle size={40} color={COLORS.error} />
          <Text style={[styles.errorStateText, { color: subTextColor }]}>Impossible de charger les données.</Text>
          <Pressable style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: textColor }]}>Bonjour{driverName ? `, ${driverName}` : ''} 👋</Text>
            <View style={styles.statsRow}>
              <Star size={14} color={COLORS.accent} fill={COLORS.accent} />
              <Text style={[styles.statText, { color: subTextColor }]}>{ratingAvg.toFixed(1)}</Text>
              <Text style={[styles.statDot, { color: subTextColor }]}>·</Text>
              <TrendingUp size={14} color={COLORS.primary} />
              <Text style={[styles.statText, { color: subTextColor }]}>Score: {reputationScore}</Text>
              <Text style={[styles.statDot, { color: subTextColor }]}>·</Text>
              <Text style={[styles.statText, { color: subTextColor }]}>{totalRides} courses</Text>
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
            onBreakdown={handleBreakdown}
            onNavigate={handleNavigate}
            onChat={handleChat}
            onCall={handleCall}
            loading={rideActionLoading || breakdownLoading}
            featChat={featChat}
            featBreakdown={featBreakdown}
          />
        )}

        {/* Empty state: no active ride + approved */}
        {!activeRide && driverStatus === 'approved' && isOnline && (
          <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
            <Car size={36} color={subTextColor} />
            <Text style={[styles.emptyStateText, { color: textColor }]}>En attente de courses...</Text>
            <Text style={[styles.emptyStateSubtext, { color: subTextColor }]}>Vous recevrez une notification dès qu'un passager vous sélectionne.</Text>
          </View>
        )}

        {/* Earnings */}
        <EarningsCard
          today={earnings.today}
          thisWeek={earnings.thisWeek}
          thisMonth={earnings.thisMonth}
          walletBalance={walletBalance}
          cardBg={cardBg}
          textColor={textColor}
          subTextColor={subTextColor}
          borderColor={borderColor}
        />

        {/* Daily goals */}
        {dailyGoals && (
          <DailyGoalsCard
            data={dailyGoals}
            cardBg={cardBg}
            textColor={textColor}
            subTextColor={subTextColor}
          />
        )}

        {/* Quick links */}
        <View style={[styles.quickLinks, { backgroundColor: cardBg }]}>
          <Pressable style={styles.quickLink} onPress={() => router.push('/(tabs)/conversations')}>
            <MessageCircle size={20} color={COLORS.primary} />
            <Text style={[styles.quickLinkText, { color: textColor }]}>Messages</Text>
            <ChevronRight size={16} color={subTextColor} />
          </Pressable>
          <View style={[styles.quickLinkDivider, { backgroundColor: borderColor }]} />
          <Pressable style={styles.quickLink} onPress={() => router.push('/(tabs)/status')}>
            <AlertCircle size={20} color={COLORS.primary} />
            <Text style={[styles.quickLinkText, { color: textColor }]}>Statut du dossier</Text>
            <ChevronRight size={16} color={subTextColor} />
          </Pressable>
          <View style={[styles.quickLinkDivider, { backgroundColor: borderColor }]} />
          <Pressable style={styles.quickLink} onPress={() => router.push('/(tabs)/heatmap')}>
            <TrendingUp size={20} color={COLORS.primary} />
            <Text style={[styles.quickLinkText, { color: textColor }]}>Carte thermique</Text>
            <ChevronRight size={16} color={subTextColor} />
          </Pressable>
        </View>

        {/* DEV button */}
        {IS_DEV && (
          <Pressable style={styles.devBtn} onPress={handleSimulateRide}>
            <Text style={styles.devBtnText}>🧪 Simuler une demande de course</Text>
          </Pressable>
        )}

      </ScrollView>

      {/* Modal passer hors ligne */}
      <Modal visible={offlineModalVisible} transparent animationType="slide" onRequestClose={() => setOfflineModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setOfflineModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <Animated.View entering={FadeIn.duration(200)} style={[styles.modalSheet, { backgroundColor: cardBg }]}>
          <View style={[styles.modalHandle, { backgroundColor: borderColor }]} />
          <View style={styles.modalHeader}>
            <WifiOff size={20} color={COLORS.primary} />
            <Text style={[styles.modalTitle, { color: textColor }]}>Passer hors ligne ?</Text>
          </View>
          <Text style={{ fontSize: 14, color: subTextColor, marginBottom: SPACING.lg, lineHeight: 20 }}>
            Vous ne recevrez plus de nouvelles courses.
          </Text>
          <TouchableOpacity
            style={[styles.modalConfirmBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => { setOfflineModalVisible(false); doToggleOnline(false); }}
          >
            <Text style={[styles.modalActionText, { color: COLORS.white }]}>Confirmer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#0F172A' : COLORS.background }]} onPress={() => setOfflineModalVisible(false)}>
            <Text style={[styles.modalActionText, { color: subTextColor }]}>Annuler</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* Modal terminer la course */}
      <Modal visible={completeModalVisible} transparent animationType="slide" onRequestClose={() => setCompleteModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setCompleteModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <Animated.View entering={FadeIn.duration(200)} style={[styles.modalSheet, { backgroundColor: cardBg }]}>
          <View style={[styles.modalHandle, { backgroundColor: borderColor }]} />
          <View style={styles.modalHeader}>
            <AlertTriangle size={20} color={COLORS.primary} />
            <Text style={[styles.modalTitle, { color: textColor }]}>Terminer la course ?</Text>
          </View>
          <Text style={{ fontSize: 14, color: subTextColor, marginBottom: SPACING.lg, lineHeight: 20 }}>
            Confirmez que vous avez déposé le passager à destination.
          </Text>
          <TouchableOpacity
            style={[styles.modalConfirmBtn, { backgroundColor: COLORS.success }]}
            onPress={confirmCompleteRide}
          >
            <Text style={[styles.modalActionText, { color: COLORS.white }]}>Terminer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#0F172A' : COLORS.background }]} onPress={() => setCompleteModalVisible(false)}>
            <Text style={[styles.modalActionText, { color: subTextColor }]}>Annuler</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* Modal panne chauffeur */}
      <Modal visible={breakdownModalVisible} transparent animationType="slide" onRequestClose={() => setBreakdownModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setBreakdownModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <Animated.View entering={FadeIn.duration(200)} style={[styles.modalSheet, { backgroundColor: cardBg }]}>
          <View style={[styles.modalHandle, { backgroundColor: borderColor }]} />
          <View style={styles.modalHeader}>
            <AlertTriangle size={20} color={COLORS.error} />
            <Text style={[styles.modalTitle, { color: textColor }]}>Signaler une panne ?</Text>
          </View>
          <Text style={{ fontSize: 14, color: subTextColor, marginBottom: SPACING.lg, lineHeight: 20 }}>
            Confirmez que vous êtes en panne. Le passager sera notifié immédiatement et nous chercherons un chauffeur de remplacement.
          </Text>
          <TouchableOpacity
            style={[styles.modalConfirmBtn, { backgroundColor: COLORS.error }]}
            onPress={confirmBreakdown}
          >
            <Text style={[styles.modalActionText, { color: COLORS.white }]}>Confirmer la panne</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#0F172A' : COLORS.background }]} onPress={() => setBreakdownModalVisible(false)}>
            <Text style={[styles.modalActionText, { color: subTextColor }]}>Annuler</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* Modal modification de destination passager */}
      <Modal visible={!!destChangeRequest} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.modalOverlay} />
        {destChangeRequest && (
          <Animated.View entering={FadeIn.duration(200)} style={[styles.modalSheet, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHandle, { backgroundColor: borderColor }]} />
            <View style={styles.modalHeader}>
              <MapPin size={20} color={COLORS.primary} />
              <Text style={[styles.modalTitle, { color: textColor }]}>Modifier la destination</Text>
              <View style={[styles.destCountdownBadge, { backgroundColor: destChangeRequest.countdown <= 15 ? '#F443361A' : `${COLORS.primary}15` }]}>
                <Text style={[styles.destCountdownText, { color: destChangeRequest.countdown <= 15 ? '#F44336' : COLORS.primary }]}>
                  {destChangeRequest.countdown}s
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: subTextColor, marginBottom: 12 }}>Le passager souhaite changer la destination :</Text>
            <View style={[styles.destChangeRow, { backgroundColor: isDark ? '#0F172A' : COLORS.background }]}>
              <Text style={[styles.destChangeLabel, { color: subTextColor }]}>Ancienne</Text>
              <Text style={[styles.destChangeValue, { color: textColor }]} numberOfLines={2}>{destChangeRequest.oldDestination}</Text>
            </View>
            <View style={[styles.destChangeRow, { backgroundColor: `${COLORS.primary}10` }]}>
              <Text style={[styles.destChangeLabel, { color: COLORS.primary }]}>Nouvelle</Text>
              <Text style={[styles.destChangeValue, { color: COLORS.primary, fontWeight: '700' }]} numberOfLines={2}>{destChangeRequest.newDestination}</Text>
            </View>
            <View style={[styles.destPriceDiff, { backgroundColor: destChangeRequest.priceDiff > 0 ? '#E8F5E9' : destChangeRequest.priceDiff < 0 ? '#FFF3E0' : `${COLORS.primary}10` }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: destChangeRequest.priceDiff > 0 ? '#2E7D32' : destChangeRequest.priceDiff < 0 ? '#E65100' : COLORS.primary }}>
                {destChangeRequest.priceDiff > 0
                  ? `+${destChangeRequest.priceDiff.toLocaleString()} pts pour le passager`
                  : destChangeRequest.priceDiff < 0
                  ? `${destChangeRequest.priceDiff.toLocaleString()} pts remboursés au passager`
                  : 'Même prix'}
              </Text>
              <Text style={{ fontSize: 12, color: subTextColor, marginTop: 2 }}>
                {destChangeRequest.oldPrice.toLocaleString()} → {destChangeRequest.newPrice.toLocaleString()} pts
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: SPACING.md }}>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { flex: 1, backgroundColor: '#F44336' }]}
                disabled={destChangeResponding}
                onPress={async () => {
                  setDestChangeResponding(true);
                  try {
                    await driverApi.respondDestinationChange(token, destChangeRequest.bookingId, false);
                    if (destChangeTimerRef.current) clearInterval(destChangeTimerRef.current);
                    setDestChangeRequest(null);
                    Toast.show({ type: 'info', text1: 'Refusé', text2: 'Le passager a été notifié.' });
                  } catch { /* ignore */ } finally { setDestChangeResponding(false); }
                }}
              >
                <Text style={[styles.modalActionText, { color: COLORS.white }]}>Refuser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { flex: 1, backgroundColor: COLORS.success }]}
                disabled={destChangeResponding}
                onPress={async () => {
                  setDestChangeResponding(true);
                  try {
                    await driverApi.respondDestinationChange(token, destChangeRequest.bookingId, true);
                    if (destChangeTimerRef.current) clearInterval(destChangeTimerRef.current);
                    setActiveRide(prev => prev ? { ...prev, destination: destChangeRequest.newDestination, estimatedPrice: destChangeRequest.newPrice } : prev);
                    setDestChangeRequest(null);
                    Toast.show({ type: 'success', text1: 'Accepté ✅', text2: destChangeRequest.newDestination });
                  } catch { /* ignore */ } finally { setDestChangeResponding(false); }
                }}
              >
                {destChangeResponding
                  ? <ActivityIndicator color={COLORS.white} size="small" />
                  : <Text style={[styles.modalActionText, { color: COLORS.white }]}>Accepter</Text>
                }
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  greeting: { fontSize: 20, fontWeight: '800' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statText: { fontSize: 13, fontWeight: '500' },
  statDot: { fontSize: 13 },

  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  statusBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: BORDER_RADIUS.card, padding: SPACING.sm, marginBottom: SPACING.sm },
  statusBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },

  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 30, paddingHorizontal: 14, paddingVertical: 8, marginBottom: SPACING.md, alignSelf: 'flex-start' },
  onlinePillActive: { backgroundColor: '#E8F8EE' },
  onlinePillInactive: { backgroundColor: COLORS.grayLight },
  onlinePillText: { fontSize: 13, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Active ride card
  activeRideCard: { borderRadius: BORDER_RADIUS.card, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: `${COLORS.primary}22` },
  activeRideAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${COLORS.primary}22`, alignItems: 'center', justifyContent: 'center' },
  activeRideAvatarText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  activeRidePassengerName: { fontSize: 14, fontWeight: '600', flex: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: BORDER_RADIUS.button, paddingVertical: 14 },
  actionBtnComplete: { backgroundColor: COLORS.success },
  actionBtnProblem: { backgroundColor: `${COLORS.error}12`, borderWidth: 1.5, borderColor: `${COLORS.error}44` },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  inProgressActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  progressBarTrack: { height: 4, backgroundColor: `${COLORS.accent}33`, borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
  progressBarFill: { height: 4, width: '60%', backgroundColor: COLORS.accent, borderRadius: 2 },

  // ActiveRideCard redesign styles
  arcHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACING.sm },
  arcTitle: { fontSize: 16, fontWeight: '800' },
  arcSubtitle: { fontSize: 13, marginTop: 2 },
  arcPrice: { fontSize: 16, fontWeight: '800', color: COLORS.accent },
  arcAvatarWrap: {},
  arcPassengerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  arcPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: BORDER_RADIUS.button, paddingVertical: 14, marginTop: 4,
  },
  arcBtnArrival: { backgroundColor: '#2196F3' },
  arcPrimaryBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  arcOutlineBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: BORDER_RADIUS.button, paddingVertical: 11, marginTop: 8,
    borderWidth: 1.5, borderColor: COLORS.grayLight,
  },
  arcOutlineBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.grayMedium },

  // Route box
  routeBox: { borderRadius: 10, padding: SPACING.sm, marginBottom: SPACING.sm },
  routeStop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  routeDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success, flexShrink: 0 },
  routeDotNavy: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, flexShrink: 0 },
  routeLine: { width: 2, height: 12, marginLeft: 4, marginVertical: 2 },
  routeStopText: { flex: 1, fontSize: 13, fontWeight: '600' },

  // Stats grid
  statsGrid: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  statCol: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statColValue: { fontSize: 14, fontWeight: '800' },
  statColLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  statColDivider: { width: 1, height: 28 },
  statColTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // ETA badge
  etaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${COLORS.success}15`, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: `${COLORS.success}30`,
  },
  etaText: { fontSize: 12, fontWeight: '700', color: COLORS.success },

  // Attente badge (gold)
  waitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3CD', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#FFDF7F',
  },
  waitBadgeText: { fontSize: 11, fontWeight: '700', color: '#B8860B' },

  // Notifié badge
  notifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${COLORS.success}12`, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  notifiedText: { fontSize: 12, fontWeight: '700', color: COLORS.success },

  // In-progress badge (navy)
  inProgressBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${COLORS.primary}18`, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  inProgressBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  // Daily goals
  goalsCard:        { borderRadius: BORDER_RADIUS.card, padding: SPACING.md, marginBottom: SPACING.md, gap: 10 },
  goalsHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalsEmoji:       { fontSize: 20 },
  goalsTitle:       { flex: 1, fontSize: 15, fontWeight: '700' },
  goalsBadge:       { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  goalsBadgeText:   { fontSize: 13, fontWeight: '800' },
  goalRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalEmoji:        { fontSize: 16, width: 22 },
  goalLabelRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  goalLabel:        { fontSize: 13, fontWeight: '600' },
  goalValue:        { fontSize: 12, fontWeight: '700' },
  goalTrack:        { height: 6, borderRadius: 3, overflow: 'hidden' },
  goalFill:         { height: 6, borderRadius: 3 },
  goalDone:         { fontSize: 14, color: '#4CAF50', fontWeight: '800' },

  // Earnings
  earningsCard: { borderRadius: BORDER_RADIUS.card, padding: SPACING.md, marginBottom: SPACING.md },
  earningsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  earningsTitle: { fontSize: 15, fontWeight: '700' },
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
  earningsStat: { flex: 1, alignItems: 'center' },
  earningsAmount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  earningsLabel: { fontSize: 11, marginTop: 2 },
  earningsDivider: { width: 1, height: 36 },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button,
    paddingVertical: 10, marginTop: SPACING.sm,
  },
  withdrawBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  // Quick links
  quickLinks: { borderRadius: BORDER_RADIUS.card, marginBottom: SPACING.md, overflow: 'hidden' },
  quickLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  quickLinkText: { flex: 1, fontSize: 14, fontWeight: '600' },
  quickLinkDivider: { height: 1, marginHorizontal: SPACING.md },

  // Dev
  devBtn: { backgroundColor: '#F0E6FF', borderRadius: BORDER_RADIUS.button, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm },
  devBtnText: { fontSize: 13, fontWeight: '600', color: '#6B21A8' },

  // Error state
  errorStateText: { fontSize: 15, marginTop: SPACING.sm, textAlign: 'center' },
  retryBtn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.button, paddingVertical: 12, paddingHorizontal: 28 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // Empty state
  emptyState: { borderRadius: BORDER_RADIUS.card, padding: SPACING.lg, marginBottom: SPACING.md, alignItems: 'center', gap: 8 },
  emptyStateText: { fontSize: 16, fontWeight: '700' },
  emptyStateSubtext: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Modal bottom sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 36,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: SPACING.lg, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.background,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalConfirmBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: SPACING.sm },
  modalCancelBtn: { marginTop: 4, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalActionText: { fontSize: 15, fontWeight: '600' },

  // Destination change modal
  destCountdownBadge: { marginLeft: 'auto', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  destCountdownText: { fontSize: 13, fontWeight: '800' },
  destChangeRow: { borderRadius: 10, padding: 12, marginBottom: 8, gap: 4 },
  destChangeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  destChangeValue: { fontSize: 14, fontWeight: '600' },
  destPriceDiff: { borderRadius: 10, padding: 12, marginTop: 4 },

  chatBadge: {
    position: 'absolute', top: -6, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  chatBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
});
