import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, RefreshCw, Plane, Clock, Gauge, ArrowUp, Navigation } from 'lucide-react-native';
import { COLORS, SPACING } from '../../lib/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguageStore } from '../../stores/languageStore';
import { driverApi } from '../../services/api';
import AIRPORTS_DATA from '../../assets/data/airports.json';

const IS_EXPO_GO = process.env.EXPO_PUBLIC_IS_EXPO_GO === 'true';
const REFRESH_MS = 30_000;
const MAX_TRAIL = 25;

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web' && !IS_EXPO_GO) {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

const AIRPORTS: { iataCode: string; latitude: number; longitude: number }[] = AIRPORTS_DATA as any;

function getAirportCoords(iata: string | null | undefined): { latitude: number; longitude: number } | null {
  if (!iata) return null;
  const a = AIRPORTS.find(x => x.iataCode === iata.toUpperCase());
  return a ? { latitude: a.latitude, longitude: a.longitude } : null;
}

function formatTime(iso: string | null | undefined, locale = 'fr-FR') {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function buildRegion(points: { latitude: number; longitude: number }[], extra: { latitude: number; longitude: number }[] = []) {
  const all = [...points, ...extra].filter(Boolean);
  if (!all.length) return { latitude: 4, longitude: 11, latitudeDelta: 20, longitudeDelta: 20 };
  const lats = all.map(p => p.latitude);
  const lngs = all.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, 4) * 1.5,
    longitudeDelta: Math.max(maxLng - minLng, 4) * 1.5,
  };
}

const COUNTRY_FLAG: Record<string, string> = {
  CM: '🇨🇲', FR: '🇫🇷', GB: '🇬🇧', TR: '🇹🇷', US: '🇺🇸', DE: '🇩🇪',
  ET: '🇪🇹', KE: '🇰🇪', MA: '🇲🇦', NG: '🇳🇬', GH: '🇬🇭', CI: '🇨🇮',
  AE: '🇦🇪', SN: '🇸🇳', CF: '🇨🇫', GA: '🇬🇦',
};

export default function FlightMapScreen() {
  const { flightNumber } = useLocalSearchParams<{ flightNumber: string }>();
  const token = useAuthStore((s) => s.token)!;
  const { isDark } = useThemeStore();
  const { lang } = useLanguageStore();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const [flight, setFlight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trail, setTrail] = useState<{ latitude: number; longitude: number }[]>([]);
  const [region, setRegion] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<any>(null);
  const trailKey = `flight_trail_${flightNumber}`;

  // Charger le trail persisté au montage
  useEffect(() => {
    if (!flightNumber) return;
    AsyncStorage.getItem(trailKey).then(raw => {
      if (raw) {
        try { setTrail(JSON.parse(raw)); } catch {}
      }
    });
  }, [trailKey]);

  const fetchFlight = useCallback(async (bg = false) => {
    if (!flightNumber) return;
    if (bg) setRefreshing(true);
    try {
      const res = await driverApi.getLiveFlightDetails(token, flightNumber);
      if (res.found && res.flight) {
        const f = res.flight;
        setFlight(f);

        const points: { latitude: number; longitude: number }[] = [];

        if (f.live && !f.live.isGround) {
          const pt = { latitude: f.live.latitude, longitude: f.live.longitude };
          setTrail(prev => {
            const last = prev[prev.length - 1];
            if (last?.latitude === pt.latitude && last?.longitude === pt.longitude) return prev;
            const next = [...prev.slice(-MAX_TRAIL + 1), pt];
            AsyncStorage.setItem(trailKey, JSON.stringify(next));
            return next;
          });
          points.push(pt);

          // Suivre l'avion automatiquement lors des refreshs en arrière-plan
          if (bg && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: pt.latitude,
              longitude: pt.longitude,
              latitudeDelta: 8,
              longitudeDelta: 8,
            }, 1000);
          }
        }

        // Nettoyer le trail si vol terminé
        if (f.status === 'landed' || f.status === 'cancelled') {
          AsyncStorage.removeItem(trailKey);
        }

        const depCoords = getAirportCoords(f.departure?.iata);
        const arrCoords = getAirportCoords(f.arrival?.iata);
        if (depCoords) points.push(depCoords);
        if (arrCoords) points.push(arrCoords);

        if (!bg && points.length) setRegion(buildRegion(points));
      }
    } catch {}
    finally {
      if (!bg) setLoading(false);
      setRefreshing(false);
    }
  }, [flightNumber, token, trailKey]);

  useEffect(() => { fetchFlight(false); }, [fetchFlight]);

  useEffect(() => {
    if (!flight) return;
    if (flight.status === 'active') {
      intervalRef.current = setInterval(() => fetchFlight(true), REFRESH_MS);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [flight?.status, fetchFlight]);

  const bg = isDark ? '#0F172A' : '#EFF6FF';
  const cardBg = isDark ? '#1E293Bcc' : '#FFFFFFee';
  const textColor = isDark ? '#F1F5F9' : '#0F172A';
  const subColor = isDark ? '#94A3B8' : '#64748B';

  if (loading) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: subColor, marginTop: 12 }}>Chargement…</Text>
      </SafeAreaView>
    );
  }

  if (!flight) {
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl }]}>
        <Pressable onPress={() => router.back()} style={{ position: 'absolute', top: SPACING.xl, left: SPACING.md }}>
          <ChevronLeft size={24} color={textColor} />
        </Pressable>
        <Plane size={48} color={subColor} />
        <Text style={{ color: textColor, fontSize: 17, fontWeight: '600', marginTop: SPACING.md, textAlign: 'center' }}>
          Vol introuvable
        </Text>
        <Text style={{ color: subColor, fontSize: 14, marginTop: SPACING.sm, textAlign: 'center', lineHeight: 20 }}>
          Les données en temps réel pour le vol {flightNumber} ne sont pas disponibles pour le moment.
          {'\n'}Réessayez dans quelques instants.
        </Text>
        <Pressable
          onPress={() => { setLoading(true); fetchFlight(false); }}
          style={{ marginTop: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Réessayer</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const live = flight?.live;
  const isAirborne = live && !live.isGround;
  const depIata = flight?.departure?.iata;
  const arrIata = flight?.arrival?.iata;
  const depCoords = getAirportCoords(depIata);
  const arrCoords = getAirportCoords(arrIata);
  const countryCode = flight?.arrival?.countryCode ?? null;
  const flag = countryCode ? (COUNTRY_FLAG[countryCode] ?? '') : '';

  const initialRegion = region ?? (live ? {
    latitude: live.latitude, longitude: live.longitude,
    latitudeDelta: 15, longitudeDelta: 15,
  } : { latitude: 4, longitude: 11, latitudeDelta: 30, longitudeDelta: 30 });

  return (
    <View style={styles.fill}>
      {/* Carte plein écran */}
      {MapView ? (
        <MapView
          ref={mapRef}
          style={styles.fill}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          mapType="satellite"
        >
          {/* Trail de positions */}
          {trail.length > 1 && Polyline && (
            <Polyline
              coordinates={trail}
              strokeColor="#60A5FA"
              strokeWidth={2.5}
              lineDashPattern={[4, 3]}
            />
          )}

          {/* Avion en temps réel */}
          {isAirborne && Marker && (
            <Marker
              coordinate={{ latitude: live.latitude, longitude: live.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              rotation={live.direction ?? 0}
              flat
            >
              <View style={styles.planeMarker}>
                <Text style={styles.planeEmoji}>✈</Text>
              </View>
            </Marker>
          )}

          {/* Aéroport de départ */}
          {depCoords && Marker && (
            <Marker coordinate={depCoords} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.airportDot}>
                <Text style={styles.airportLabel}>{depIata}</Text>
              </View>
            </Marker>
          )}

          {/* Aéroport d'arrivée */}
          {arrCoords && Marker && (
            <Marker coordinate={arrCoords} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.airportDot, styles.arrivalDot]}>
                <Text style={styles.airportLabel}>{arrIata}</Text>
              </View>
            </Marker>
          )}
        </MapView>
      ) : (
        <View style={[styles.fill, { backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 48 }}>✈</Text>
          <Text style={{ color: '#94A3B8', marginTop: 8 }}>Carte non disponible</Text>
        </View>
      )}

      {/* Header overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={[styles.headerCard, { backgroundColor: cardBg }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={22} color={textColor} strokeWidth={2.5} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.flightNum, { color: textColor }]}>{flight?.flightNumber ?? flightNumber}</Text>
            <Text style={[styles.airlineName, { color: subColor }]}>
              {flight?.airline?.name ?? '—'}{flight?.aircraft ? ` · ${flight.aircraft}` : ''}
            </Text>
          </View>
          {refreshing
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Pressable onPress={() => fetchFlight(true)} style={styles.refreshBtn}>
                <RefreshCw size={16} color={COLORS.primary} />
              </Pressable>
          }
        </View>
      </SafeAreaView>

      {/* Bottom info panel */}
      <View style={[styles.bottomPanel, { backgroundColor: cardBg }]}>
        {/* Route */}
        <View style={styles.routeRow}>
          <View style={styles.airportBlock}>
            <Text style={[styles.iata, { color: COLORS.primary }]}>{depIata ?? '—'}</Text>
            <Text style={[styles.airportSub, { color: subColor }]}>{flight?.departure?.gate ? `Gate ${flight.departure.gate}` : 'Départ'}</Text>
          </View>
          <View style={styles.routeMid}>
            <Plane size={16} color={subColor} />
            <View style={[styles.routeLine, { backgroundColor: subColor }]} />
          </View>
          <View style={[styles.airportBlock, { alignItems: 'flex-end' }]}>
            <Text style={[styles.iata, { color: '#E53935' }]}>{arrIata ?? '—'} {flag}</Text>
            <Text style={[styles.airportSub, { color: subColor }]}>{countryCode ?? 'Arrivée'}</Text>
          </View>
        </View>

        {/* Stats live */}
        {isAirborne ? (
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <ArrowUp size={13} color={subColor} />
              <Text style={[styles.statVal, { color: textColor }]}>{Math.round(live.altitude).toLocaleString()}<Text style={[styles.statUnit, { color: subColor }]}> m</Text></Text>
              <Text style={[styles.statLbl, { color: subColor }]}>Altitude</Text>
            </View>
            <View style={styles.statBlock}>
              <Gauge size={13} color={subColor} />
              <Text style={[styles.statVal, { color: textColor }]}>{Math.round(live.speedHorizontal)}<Text style={[styles.statUnit, { color: subColor }]}> km/h</Text></Text>
              <Text style={[styles.statLbl, { color: subColor }]}>Vitesse</Text>
            </View>
            <View style={styles.statBlock}>
              <Navigation size={13} color={subColor} />
              <Text style={[styles.statVal, { color: textColor }]}>{live.direction}<Text style={[styles.statUnit, { color: subColor }]}>°</Text></Text>
              <Text style={[styles.statLbl, { color: subColor }]}>Cap</Text>
            </View>
            <View style={styles.statBlock}>
              <Clock size={13} color={subColor} />
              <Text style={[styles.statVal, { color: textColor }]}>{formatTime(flight?.arrival?.predicted ?? flight?.arrival?.estimated, locale)}</Text>
              <Text style={[styles.statLbl, { color: subColor }]}>ETA</Text>
            </View>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Clock size={13} color={subColor} />
              <Text style={[styles.statVal, { color: textColor }]}>{formatTime(flight?.arrival?.scheduled, locale)}</Text>
              <Text style={[styles.statLbl, { color: subColor }]}>Prévue</Text>
            </View>
            <View style={styles.statBlock}>
              <Clock size={13} color="#F59E0B" />
              <Text style={[styles.statVal, { color: textColor }]}>{formatTime(flight?.arrival?.predicted ?? flight?.arrival?.estimated, locale)}</Text>
              <Text style={[styles.statLbl, { color: subColor }]}>Estimée</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={{ fontSize: 13 }}>{flight?.status === 'landed' ? '🛬' : flight?.status === 'cancelled' ? '❌' : '🕐'}</Text>
              <Text style={[styles.statVal, { color: textColor, fontSize: 13 }]}>{
                flight?.status === 'landed' ? 'Atterri' :
                flight?.status === 'cancelled' ? 'Annulé' :
                flight?.status === 'active' ? 'En vol' : 'Programmé'
              }</Text>
              <Text style={[styles.statLbl, { color: subColor }]}>Statut</Text>
            </View>
          </View>
        )}

        {/* Update time */}
        {live && (
          <Text style={[styles.updateTime, { color: subColor }]}>
            Mis à jour · {new Date(live.updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto-refresh 30s
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flightNum: { fontSize: 16, fontWeight: '800' },
  airlineName: { fontSize: 11, marginTop: 1 },
  planeMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1D4ED8', shadowOpacity: 0.5, shadowRadius: 6, elevation: 6,
  },
  planeEmoji: { fontSize: 18, color: '#fff' },
  airportDot: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: '#374151', alignItems: 'center',
  },
  arrivalDot: { backgroundColor: '#B91C1C' },
  airportLabel: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  airportBlock: { flex: 1 },
  iata: { fontSize: 24, fontWeight: '900' },
  airportSub: { fontSize: 11, marginTop: 2 },
  routeMid: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  routeLine: { flex: 1, height: 1.5, width: 40 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statBlock: { alignItems: 'center', gap: 3, flex: 1 },
  statVal: { fontSize: 15, fontWeight: '800' },
  statUnit: { fontSize: 11, fontWeight: '400' },
  statLbl: { fontSize: 10, textAlign: 'center' },
  updateTime: { fontSize: 10, textAlign: 'center', marginTop: 2 },
});
