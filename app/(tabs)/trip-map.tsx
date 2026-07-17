import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { ChevronLeft, MapPin, RefreshCw } from 'lucide-react-native';
import { COLORS, SPACING } from '../../lib/shared';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';

const AIRPORT_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  DLA: { lat: 4.0061, lng: 9.7197,  name: 'Aéroport International de Douala' },
  NSI: { lat: 3.7226, lng: 11.5532, name: 'Aéroport de Yaoundé-Nsimalen' },
};

type PlanePosition = {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  direction: number;
  isGround: boolean;
  updatedAt: string;
};

type ViewMode = 'driver' | 'flight' | 'both';

function buildLeafletHTML(opts: {
  driverLat: number | null;
  driverLng: number | null;
  airportLat: number;
  airportLng: number;
  airportCode: string;
  planeLat: number | null;
  planeLng: number | null;
  planeDir: number | null;
  viewMode: ViewMode;
  isDark: boolean;
}) {
  const { driverLat, driverLng, airportLat, airportLng, airportCode,
          planeLat, planeLng, planeDir, viewMode, isDark } = opts;

  const centerLat = driverLat ?? airportLat;
  const centerLng = driverLng ?? airportLng;

  const driverMarker = (driverLat && driverLng && viewMode !== 'flight')
    ? `L.marker([${driverLat}, ${driverLng}], {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:38px;height:38px;border-radius:50%;background:${COLORS.primary};display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:18px;">🚗</div>',
          iconSize:[38,38], iconAnchor:[19,19]
        })
      }).addTo(map).bindPopup('Votre position');`
    : '';

  const airportMarker = `L.marker([${airportLat}, ${airportLng}], {
      icon: L.divIcon({
        className: '',
        html: '<div style="background:#E53935;color:white;font-weight:800;padding:5px 10px;border-radius:20px;font-size:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);">✈ ${airportCode}</div>',
        iconAnchor:[30,14]
      })
    }).addTo(map).bindPopup('${AIRPORT_COORDS[airportCode]?.name ?? airportCode}');`;

  const planeMarker = (planeLat && planeLng && viewMode !== 'driver')
    ? `L.marker([${planeLat}, ${planeLng}], {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:36px;height:36px;border-radius:50%;background:#FF6D00;display:flex;align-items:center;justify-content:center;font-size:20px;transform:rotate(${planeDir ?? 0}deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);">✈</div>',
          iconSize:[36,36], iconAnchor:[18,18]
        })
      }).addTo(map).bindPopup('Vol en cours');`
    : '';

  // Tracé route chauffeur → aéroport via OSRM
  const driverRoute = (driverLat && driverLng && viewMode !== 'flight')
    ? `fetch('https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${airportLng},${airportLat}?overview=full&geometries=geojson')
        .then(r=>r.json()).then(data=>{
          const coords = data.routes?.[0]?.geometry?.coordinates;
          if(coords){
            const latlngs = coords.map(([lng,lat])=>[lat,lng]);
            L.polyline(latlngs,{color:'${COLORS.primary}',weight:5,opacity:0.85}).addTo(map);
            const d = data.routes[0].distance, t = data.routes[0].duration;
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type:'routeInfo',
              distance: d<1000 ? Math.round(d)+'m' : (d/1000).toFixed(1)+'km',
              duration: t<3600 ? Math.round(t/60)+'min' : Math.floor(t/3600)+'h'+String(Math.round((t%3600)/60)).padStart(2,'0')
            }));
          }
        }).catch(()=>{
          L.polyline([[${driverLat},${driverLng}],[${airportLat},${airportLng}]],{color:'${COLORS.primary}',weight:4,opacity:0.6,dashArray:'8,6'}).addTo(map);
        });`
    : '';

  // Tracé avion → aéroport (ligne pointillée)
  const planeRoute = (planeLat && planeLng && viewMode !== 'driver')
    ? `L.polyline([[${planeLat},${planeLng}],[${airportLat},${airportLng}]],{color:'#FF6D00',weight:3,dashArray:'12,8',opacity:0.8}).addTo(map);`
    : '';

  // Ajuster la vue
  const points: string[] = [];
  if (driverLat && driverLng && viewMode !== 'flight') points.push(`[${driverLat},${driverLng}]`);
  if (planeLat && planeLng && viewMode !== 'driver') points.push(`[${planeLat},${planeLng}]`);
  points.push(`[${airportLat},${airportLng}]`);
  const fitBounds = points.length > 1
    ? `map.fitBounds([${points.join(',')}], {padding:[60,60]});`
    : `map.setView([${centerLat},${centerLng}], 12);`;

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%;}</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map', {zoomControl:false, attributionControl:false});
  L.tileLayer('${tileUrl}', {maxZoom:18}).addTo(map);
  map.setView([${centerLat},${centerLng}], 12);
  ${driverMarker}
  ${airportMarker}
  ${planeMarker}
  ${driverRoute}
  ${planeRoute}
  setTimeout(function(){ ${fitBounds} }, 300);
</script></body></html>`;
}

export default function TripMapScreen() {
  const { airport, passengerName, destination, flightNumber } = useLocalSearchParams<{
    airport: string;
    passengerName?: string;
    destination?: string;
    flightNumber?: string;
  }>();

  const token = useAuthStore((s) => s.token)!;
  const { isDark } = useThemeStore();
  const webviewRef = useRef<WebView>(null);

  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [planePos, setPlanePos] = useState<PlanePosition | null>(null);
  const [flightLoading, setFlightLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(flightNumber ? 'both' : 'driver');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const airportInfo = AIRPORT_COORDS[airport] ?? AIRPORT_COORDS.DLA;
  const airportCoord = { latitude: airportInfo.lat, longitude: airportInfo.lng };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission de localisation refusée');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLoading(false);
    })();
  }, []);

  const fetchPlanePosition = async () => {
    if (!flightNumber || !token) return;
    setFlightLoading(true);
    try {
      const res = await driverApi.getLiveFlightDetails(token, flightNumber);
      if (res.found && res.flight?.live && !res.flight.live.isGround) {
        setPlanePos({
          latitude: res.flight.live.latitude,
          longitude: res.flight.live.longitude,
          altitude: res.flight.live.altitude,
          speed: res.flight.live.speedHorizontal,
          direction: res.flight.live.direction,
          isGround: res.flight.live.isGround,
          updatedAt: res.flight.live.updatedAt,
        });
        setLastRefresh(new Date());
      }
    } catch {
      // silencieux
    } finally {
      setFlightLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanePosition();
    const interval = setInterval(fetchPlanePosition, 60_000);
    return () => clearInterval(interval);
  }, [flightNumber, token]);

  const mapHtml = buildLeafletHTML({
    driverLat: driverLocation?.latitude ?? null,
    driverLng: driverLocation?.longitude ?? null,
    airportLat: airportCoord.latitude,
    airportLng: airportCoord.longitude,
    airportCode: airport,
    planeLat: planePos?.latitude ?? null,
    planeLng: planePos?.longitude ?? null,
    planeDir: planePos?.direction ?? null,
    viewMode,
    isDark,
  });

  const cardBg   = isDark ? '#1E293B' : COLORS.white;
  const textColor = isDark ? '#F1F5F9' : COLORS.black;
  const subColor  = isDark ? '#94A3B8' : COLORS.grayMedium;
  const bg        = isDark ? '#0F172A' : COLORS.background;

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      {/* Header flottant */}
      <SafeAreaView style={styles.headerWrap} edges={['top']}>
        <View style={[styles.header, { backgroundColor: cardBg }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={22} color={textColor} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: textColor }]}>
              {viewMode === 'driver' ? `Route → ${airport}` : viewMode === 'flight' ? `Vol ${flightNumber}` : `${flightNumber} → ${airport}`}
            </Text>
            <Text style={[styles.headerSub, { color: subColor }]} numberOfLines={1}>
              {airportInfo.name}
            </Text>
          </View>
          {flightNumber && (
            <Pressable onPress={fetchPlanePosition} style={styles.refreshBtn} disabled={flightLoading}>
              {flightLoading
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <RefreshCw size={18} color={COLORS.primary} />}
            </Pressable>
          )}
        </View>

        {flightNumber && (
          <View style={[styles.modeBar, { backgroundColor: cardBg }]}>
            {(['driver', 'flight', 'both'] as ViewMode[]).map((m) => {
              const labels = { driver: '🚗 Route', flight: '✈ Vol', both: '🌍 Les deux' };
              return (
                <Pressable
                  key={m}
                  style={[styles.modeBtn, viewMode === m && styles.modeBtnActive]}
                  onPress={() => setViewMode(m)}
                >
                  <Text style={[styles.modeBtnText, viewMode === m && styles.modeBtnTextActive]}>
                    {labels[m]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </SafeAreaView>

      {/* Carte */}
      {loading ? (
        <View style={[styles.center, { backgroundColor: bg }]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: subColor }]}>Localisation…</Text>
        </View>
      ) : locationError && viewMode === 'driver' ? (
        <View style={[styles.center, { backgroundColor: bg }]}>
          <MapPin size={40} color={subColor} />
          <Text style={[styles.errorText, { color: textColor }]}>{locationError}</Text>
        </View>
      ) : (
        <WebView
          ref={webviewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          scrollEnabled={false}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.type === 'routeInfo') {
                setDistance(data.distance);
                setDuration(data.duration);
              }
            } catch {}
          }}
        />
      )}

      {/* Info bas */}
      {!loading && (
        <View style={[styles.infoCard, { backgroundColor: cardBg }]}>
          <View style={styles.infoRow}>
            {(viewMode === 'driver' || viewMode === 'both') && (
              <>
                <View style={styles.infoBlock}>
                  <Text style={[styles.infoLabel, { color: subColor }]}>Distance</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>{distance ?? '—'}</Text>
                </View>
                <View style={styles.infoBlock}>
                  <Text style={[styles.infoLabel, { color: subColor }]}>Durée</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>{duration ?? '—'}</Text>
                </View>
              </>
            )}
            {(viewMode === 'flight' || viewMode === 'both') && planePos && (
              <>
                <View style={styles.infoBlock}>
                  <Text style={[styles.infoLabel, { color: subColor }]}>Altitude</Text>
                  <Text style={[styles.infoValue, { color: '#FF6D00' }]}>{(planePos.altitude / 1000).toFixed(1)} km</Text>
                </View>
                <View style={styles.infoBlock}>
                  <Text style={[styles.infoLabel, { color: subColor }]}>Vitesse</Text>
                  <Text style={[styles.infoValue, { color: '#FF6D00' }]}>{Math.round(planePos.speed)} km/h</Text>
                </View>
              </>
            )}
            {(viewMode === 'flight' || viewMode === 'both') && !planePos && (
              <View style={styles.infoBlock}>
                <Text style={[styles.infoLabel, { color: subColor }]}>Position avion</Text>
                <Text style={[styles.infoValue, { color: subColor }]}>Non disponible</Text>
              </View>
            )}
          </View>
          <View style={styles.bottomRow}>
            {destination && (
              <View style={styles.destRow}>
                <MapPin size={13} color={subColor} />
                <Text style={[styles.destText, { color: subColor }]} numberOfLines={1}>
                  Destination : {destination}
                </Text>
              </View>
            )}
            {lastRefresh && (
              <Text style={[styles.refreshTime, { color: subColor }]}>
                Mis à jour {formatTime(lastRefresh.toISOString())}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 8, borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  refreshBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  modeBar: {
    flexDirection: 'row', marginHorizontal: 12, marginTop: 6,
    borderRadius: 12, padding: 4, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.grayMedium },
  modeBtnTextActive: { color: COLORS.white },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 16, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
  infoCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.md, paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  infoRow: { flexDirection: 'row', gap: 24, marginBottom: 8, flexWrap: 'wrap' },
  infoBlock: { gap: 2 },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 20, fontWeight: '800' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  destText: { fontSize: 12, flex: 1 },
  refreshTime: { fontSize: 11 },
});
