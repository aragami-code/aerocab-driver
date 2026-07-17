import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, Plane, MapPin, Navigation,
  Gauge, ArrowUp, Map, Info,
} from 'lucide-react-native';
import { COLORS, SPACING } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { driverApi } from '../../services/api';

const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  DLA: { lat: 4.0061,  lng: 9.7197  },
  NSI: { lat: 3.7226,  lng: 11.5532 },
  BGF: { lat: 5.2512,  lng: 18.5219 },
  YAO: { lat: 3.8362,  lng: 11.5234 },
  CDG: { lat: 49.0097, lng: 2.5479  },
  ORY: { lat: 48.7233, lng: 2.3794  },
  LHR: { lat: 51.4700, lng: -0.4543 },
  JFK: { lat: 40.6413, lng: -73.7781},
  CMN: { lat: 33.3675, lng: -7.5899 },
  ABJ: { lat: 5.2612,  lng: -3.9262 },
  LOS: { lat: 6.5774,  lng: 3.3210  },
  ACC: { lat: 5.6052,  lng: -0.1669 },
  IST: { lat: 41.2608, lng: 28.7418 },
  ADD: { lat: 8.9779,  lng: 38.7993 },
  NBO: { lat: -1.3192, lng: 36.9275 },
  DXB: { lat: 25.2528, lng: 55.3644 },
};

const LIVE_REFRESH_MS = 30_000; // 30 secondes
const MAX_TRAIL = 20;           // max positions gardées en mémoire

function buildRegion(points: { latitude: number; longitude: number }[], paddingFactor = 1.4) {
  if (!points.length) return { latitude: 4, longitude: 11, latitudeDelta: 10, longitudeDelta: 10 };
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const latDelta = Math.max(maxLat - minLat, 3) * paddingFactor;
  const lngDelta = Math.max(maxLng - minLng, 3) * paddingFactor;
  return { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatUpdatedAt(date: Date | null) {
  if (!date) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function compassDir(degrees: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(degrees / 45) % 8];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: 'En vol ✈',       bg: '#E3F2FD', text: '#1565C0' },
  landed:    { label: 'Atterri ✅',     bg: '#E8F5E9', text: '#2E7D32' },
  scheduled: { label: 'Programmé 🕐',   bg: '#FFF8E1', text: '#E65100' },
  cancelled: { label: 'Annulé ❌',      bg: '#FDECEA', text: '#C62828' },
  diverted:  { label: 'Dérouté ⚠️',    bg: '#FFF3E0', text: '#E65100' },
};

// Composant point clignotant "live"
function LiveDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[styles.liveDot, { opacity: anim }]} />;
}

export default function FlightDetailsScreen() {
  const { flightNumber } = useLocalSearchParams<{ flightNumber: string }>();
  const token = useAuthStore((s) => s.token)!;
  const { isDark } = useThemeStore();

  const bg       = isDark ? '#0F172A' : COLORS.background;
  const cardBg   = isDark ? '#1E293B' : COLORS.white;
  const textColor= isDark ? '#F1F5F9' : COLORS.black;
  const subColor = isDark ? '#94A3B8' : COLORS.grayMedium;
  const borderColor = isDark ? '#334155' : COLORS.grayLight;

  const [flight, setFlight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [trail, setTrail] = useState<{ latitude: number; longitude: number }[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFlight = useCallback(async (isBackground = false) => {
    if (!flightNumber) return;
    if (isBackground) setRefreshing(true);
    try {
      const res = await driverApi.getLiveFlightDetails(token, flightNumber);
      if (res.found && res.flight) {
        const flightData = res.flight;
        setFlight((prev: any) => {
          // Ajouter position live au trail
          if (flightData.live && !flightData.live.isGround) {
            const newPt = { latitude: flightData.live.latitude, longitude: flightData.live.longitude };
            setTrail(prev => {
              const last = prev[prev.length - 1];
              if (last && last.latitude === newPt.latitude && last.longitude === newPt.longitude) return prev;
              return [...prev.slice(-MAX_TRAIL + 1), newPt];
            });
          }
          return flightData;
        });
        setUpdatedAt(new Date());
        setNotFound(false);
      } else if (!isBackground) {
        setNotFound(true);
      }
    } catch {
      if (!isBackground) setNotFound(true);
    } finally {
      if (!isBackground) setLoading(false);
      setRefreshing(false);
    }
  }, [flightNumber, token]);

  useEffect(() => {
    fetchFlight(false);
  }, [fetchFlight]);

  // Polling automatique quand vol actif
  useEffect(() => {
    if (!flight) return;
    if (flight.status === 'active') {
      intervalRef.current = setInterval(() => fetchFlight(true), LIVE_REFRESH_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [flight?.status, fetchFlight]);

  const openLiveMap = () => {
    router.push({ pathname: '/(tabs)/flight-map', params: { flightNumber: flight.flightNumber } });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: subColor }]}>Chargement du vol…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Guard défensif : structure minimale requise pour le rendu
  const hasValidStructure = flight && flight.departure && flight.arrival && flight.airline;

  if (notFound || !hasValidStructure) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={textColor} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.center}>
          <Info size={40} color={subColor} />
          <Text style={[styles.notFoundText, { color: textColor }]}>Vol introuvable</Text>
          <Text style={[styles.notFoundSub, { color: subColor }]}>Données non disponibles pour {flightNumber}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[flight.status] ?? { label: flight.status, bg: '#F5F5F5', text: '#666' };
  const isAirborne = flight.live && !flight.live.isGround;
  const isActive = flight.status === 'active';

  const hasLive = !!flight.live;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color={textColor} strokeWidth={2.5} />
        </Pressable>
        <View>
          <Text style={[styles.flightNum, { color: textColor }]}>{flight.flightNumber}</Text>
          <Text style={[styles.airlineName, { color: subColor }]}>{flight.airline?.name ?? '—'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Route */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.routeRow}>
            <View style={styles.routeAirport}>
              <Text style={[styles.iataCode, { color: COLORS.primary }]}>{flight.departure.iata ?? '—'}</Text>
              <Text style={[styles.airportName, { color: subColor }]} numberOfLines={2}>{flight.departure.airport ?? '—'}</Text>
              {flight.departure.terminal && (
                <Text style={[styles.terminal, { color: subColor }]}>Terminal {flight.departure.terminal}{flight.departure.gate ? ` · Porte ${flight.departure.gate}` : ''}</Text>
              )}
            </View>

            <View style={styles.routeCenter}>
              <Plane size={20} color={COLORS.primary} />
              <View style={[styles.routeLine, { backgroundColor: borderColor }]} />
            </View>

            <View style={[styles.routeAirport, styles.routeRight]}>
              <Text style={[styles.iataCode, { color: COLORS.primary }]}>{flight.arrival.iata ?? '—'}</Text>
              {flight.arrival.countryCode && (
                <Text style={[styles.airportName, { color: subColor }]}>{flight.arrival.countryCode}</Text>
              )}
              <Text style={[styles.airportName, { color: subColor }]} numberOfLines={2}>{flight.arrival.airport ?? '—'}</Text>
              {flight.arrival.terminal && (
                <Text style={[styles.terminal, { color: subColor }]}>Terminal {flight.arrival.terminal}{flight.arrival.baggage ? ` · Bagage ${flight.arrival.baggage}` : ''}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Trajectoire visuelle (sans MapView) */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.trajectoryHeader}>
            {isActive && <LiveDot />}
            <Text style={[styles.cardTitle, { color: textColor, marginBottom: 0 }]}>
              {isActive ? 'Position en direct' : 'Route prévue'}
            </Text>
            {refreshing && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 6 }} />}
            <Pressable onPress={openLiveMap} style={{ marginLeft: 'auto' }}>
              <Map size={14} color={COLORS.primary} />
            </Pressable>
          </View>

          <View style={styles.trajectoryRow}>
            {/* Départ */}
            <View style={styles.trajectoryAirport}>
              <View style={[styles.trajectoryDot, { backgroundColor: '#546E7A' }]} />
              <Text style={[styles.trajectoryIata, { color: textColor }]}>{flight.departure.iata ?? '?'}</Text>
              <Text style={[styles.trajectoryName, { color: subColor }]} numberOfLines={1}>{flight.departure.airport ?? ''}</Text>
            </View>

            {/* Ligne + avion */}
            <View style={styles.trajectoryLine}>
              <View style={[styles.trajectoryBar, { backgroundColor: borderColor }]} />
              <View style={styles.trajectoryPlane}>
                <Text style={{ fontSize: 20 }}>✈</Text>
              </View>
              <View style={[styles.trajectoryBar, { backgroundColor: borderColor }]} />
            </View>

            {/* Arrivée */}
            <View style={[styles.trajectoryAirport, { alignItems: 'flex-end' }]}>
              <View style={[styles.trajectoryDot, { backgroundColor: '#E53935' }]} />
              <Text style={[styles.trajectoryIata, { color: textColor }]}>{flight.arrival.iata ?? '?'}</Text>
              <Text style={[styles.trajectoryName, { color: subColor }]} numberOfLines={1}>{flight.arrival.airport ?? ''}</Text>
            </View>
          </View>

          {isAirborne && (
            <View style={styles.liveCoords}>
              <MapPin size={12} color={subColor} />
              <Text style={[styles.legendText, { color: subColor }]}>
                {flight.live.latitude.toFixed(4)}°, {flight.live.longitude.toFixed(4)}°
              </Text>
              {updatedAt && (
                <Text style={[styles.legendText, { color: subColor }]}>· {formatUpdatedAt(updatedAt)}</Text>
              )}
            </View>
          )}

          <Pressable
            onPress={openLiveMap}
            style={[styles.fr24Btn, { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' }]}
          >
            <Map size={13} color={COLORS.primary} />
            <Text style={[styles.fr24BtnText, { color: COLORS.primary }]}>Ouvrir la carte live</Text>
          </Pressable>
        </View>

        {/* Position live chiffres */}
        {isAirborne && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Données de vol</Text>
            <View style={styles.liveGrid}>
              <View style={styles.liveBlock}>
                <ArrowUp size={16} color={COLORS.primary} />
                <Text style={[styles.liveValue, { color: textColor }]}>{Math.round(flight.live.altitude).toLocaleString()} m</Text>
                <Text style={[styles.liveLabel, { color: subColor }]}>Altitude</Text>
              </View>
              <View style={styles.liveBlock}>
                <Gauge size={16} color={COLORS.primary} />
                <Text style={[styles.liveValue, { color: textColor }]}>{Math.round(flight.live.speedHorizontal)} km/h</Text>
                <Text style={[styles.liveLabel, { color: subColor }]}>Vitesse</Text>
              </View>
              <View style={styles.liveBlock}>
                <Navigation size={16} color={COLORS.primary} />
                <Text style={[styles.liveValue, { color: textColor }]}>{compassDir(flight.live.direction)} ({flight.live.direction}°)</Text>
                <Text style={[styles.liveLabel, { color: subColor }]}>Cap</Text>
              </View>
              <View style={styles.liveBlock}>
                <MapPin size={16} color={COLORS.primary} />
                <Text style={[styles.liveValue, { color: textColor }]}>
                  {flight.live.latitude.toFixed(3)}°
                </Text>
                <Text style={[styles.liveValue, { color: textColor }]}>
                  {flight.live.longitude.toFixed(3)}°
                </Text>
                <Text style={[styles.liveLabel, { color: subColor }]}>Coordonnées</Text>
              </View>
            </View>
          </View>
        )}

        {/* Horaires */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Horaires</Text>
          <View style={styles.timesGrid}>
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: subColor }]}>Départ prévu</Text>
              <Text style={[styles.timeValue, { color: textColor }]}>{formatTime(flight.departure.scheduled)}</Text>
              <Text style={[styles.timeDate, { color: subColor }]}>{formatDate(flight.departure.scheduled)}</Text>
            </View>
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: subColor }]}>Départ réel</Text>
              <Text style={[styles.timeValue, { color: flight.departure.actual ? COLORS.success : subColor }]}>
                {formatTime(flight.departure.actual)}
              </Text>
              {(flight.departure.delay ?? 0) > 0 && (
                <Text style={styles.delay}>+{flight.departure.delay} min</Text>
              )}
            </View>
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: subColor }]}>Arrivée prévue</Text>
              <Text style={[styles.timeValue, { color: textColor }]}>{formatTime(flight.arrival.scheduled)}</Text>
              <Text style={[styles.timeDate, { color: subColor }]}>{formatDate(flight.arrival.scheduled)}</Text>
            </View>
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: subColor }]}>Arrivée prédite</Text>
              <Text style={[styles.timeValue, { color: flight.arrival.predicted ? COLORS.primary : textColor }]}>
                {formatTime(flight.arrival.actual ?? flight.arrival.predicted ?? flight.arrival.estimated)}
              </Text>
              {(flight.arrival.delay ?? 0) > 0 && (
                <Text style={styles.delay}>+{flight.arrival.delay} min</Text>
              )}
            </View>
          </View>
        </View>

        {/* Appareil */}
        {flight.aircraft && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Appareil</Text>
            <Text style={[styles.aircraftType, { color: textColor }]}>{flight.aircraft}</Text>
          </View>
        )}

        {/* Bouton carte live */}
        <Pressable
          style={[styles.externalCard, { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
          onPress={openLiveMap}
        >
          <Map size={16} color="#fff" />
          <Text style={[styles.externalCardText, { color: '#fff' }]}>
            Suivre {flight.flightNumber} en direct sur la carte
          </Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  notFoundText: { fontSize: 18, fontWeight: '700' },
  notFoundSub: { fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  flightNum: { fontSize: 18, fontWeight: '800' },
  airlineName: { fontSize: 12 },
  statusBadge: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  content: { padding: SPACING.md, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 14, padding: 16, borderWidth: 1 },
  cardTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  // Route
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeAirport: { flex: 1 },
  routeRight: { alignItems: 'flex-end' },
  routeCenter: { alignItems: 'center', paddingTop: 4, paddingHorizontal: 8, gap: 4 },
  routeLine: { height: 2, width: 40 },
  iataCode: { fontSize: 28, fontWeight: '900' },
  airportName: { fontSize: 12, marginTop: 2 },
  terminal: { fontSize: 11, marginTop: 4 },
  // Trajectoire visuelle
  trajectoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  trajectoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trajectoryAirport: { flex: 1, alignItems: 'flex-start', gap: 4 },
  trajectoryDot: { width: 10, height: 10, borderRadius: 5 },
  trajectoryIata: { fontSize: 22, fontWeight: '900' },
  trajectoryName: { fontSize: 10, maxWidth: 90 },
  trajectoryLine: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  trajectoryBar: { flex: 1, height: 2 },
  trajectoryPlane: { paddingHorizontal: 4 },
  liveCoords: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  fr24Btn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  fr24BtnText: { fontSize: 12, fontWeight: '600' },
  legendText: { fontSize: 11 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E53935' },
  // Live data
  liveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  liveBlock: { width: '44%', alignItems: 'flex-start', gap: 4 },
  liveValue: { fontSize: 15, fontWeight: '700' },
  liveLabel: { fontSize: 11 },
  // Horaires
  timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  timeBlock: { width: '44%', gap: 2 },
  timeLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  timeValue: { fontSize: 22, fontWeight: '800' },
  timeDate: { fontSize: 11 },
  delay: { fontSize: 11, color: '#E65100', fontWeight: '700' },
  // Appareil
  aircraftRow: { flexDirection: 'row', alignItems: 'center' },
  aircraftInfo: { gap: 2 },
  aircraftType: { fontSize: 20, fontWeight: '800' },
  aircraftReg: { fontSize: 13 },
  // Lien externe
  externalCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 16, borderWidth: 1 },
  externalCardText: { fontSize: 14, fontWeight: '600' },
});
