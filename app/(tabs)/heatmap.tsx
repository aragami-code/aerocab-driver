import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import { ArrowLeft, RefreshCw, MapPin } from 'lucide-react-native';
import { COLORS, SPACING } from '../../lib/shared';
import { useAuthStore } from '../../stores/authStore';
import { driverApi } from '../../services/api';

type Zone = { lat: number; lng: number; count: number; intensity: 'low' | 'medium' | 'high' };

const INTENSITY_COLOR = { low: '#4CAF50', medium: '#FF9800', high: '#F44336' } as const;
const INTENSITY_RADIUS = { low: 400, medium: 700, high: 1100 } as const;
const INTENSITY_LABEL  = { low: 'Faible', medium: 'Modérée', high: 'Forte' } as const;

function buildHeatmapHTML(zones: Zone[], isDark: boolean): string {
  const bg     = isDark ? '#1a1a2e' : '#f0f0f0';
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const centerLat = zones.length ? zones.reduce((s, z) => s + z.lat, 0) / zones.length : 4.051;
  const centerLng = zones.length ? zones.reduce((s, z) => s + z.lng, 0) / zones.length : 9.702;

  const circles = zones.map(z => {
    const color  = INTENSITY_COLOR[z.intensity];
    const radius = INTENSITY_RADIUS[z.intensity];
    return `L.circle([${z.lat}, ${z.lng}], {
      radius: ${radius},
      color: '${color}',
      fillColor: '${color}',
      fillOpacity: 0.35,
      weight: 1.5,
      opacity: 0.7,
    }).addTo(map).bindPopup('<b>${z.count} course${z.count > 1 ? 's' : ''}</b><br>Demande : ${INTENSITY_LABEL[z.intensity]}');`;
  }).join('\n');

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${bg};}</style>
</head><body>
<div id="map"></div>
<script>
const map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${centerLat}, ${centerLng}], 13);
L.tileLayer('${tileUrl}', { maxZoom: 18 }).addTo(map);
${circles}
</script>
</body></html>`;
}

export default function HeatmapScreen() {
  const token = useAuthStore((s) => s.token);
  const webviewRef = useRef<WebView>(null);
  const [zones, setZones]     = useState<Zone[]>([]);
  const [since, setSince]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    try {
      const res = await driverApi.getHeatmapZones(token);
      setZones(res.zones);
      setSince(res.since);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh toutes les 2 minutes
  useEffect(() => {
    const id = setInterval(() => { load(); }, 120000);
    return () => clearInterval(id);
  }, [load]);

  const high   = zones.filter(z => z.intensity === 'high').length;
  const medium = zones.filter(z => z.intensity === 'medium').length;
  const low    = zones.filter(z => z.intensity === 'low').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={COLORS.black} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Carte thermique</Text>
          {since && (
            <Text style={styles.subtitle}>7 derniers jours</Text>
          )}
        </View>
        <Pressable onPress={load} style={styles.refreshBtn}>
          <RefreshCw size={18} color={COLORS.primary} />
        </Pressable>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {(['high', 'medium', 'low'] as const).map(k => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: INTENSITY_COLOR[k] }]} />
            <Text style={styles.legendText}>{INTENSITY_LABEL[k]}</Text>
          </View>
        ))}
        <View style={styles.legendSep} />
        <Text style={styles.legendCount}>
          {high > 0 && `${high}🔴 `}{medium > 0 && `${medium}🟠 `}{low > 0 && `${low}🟢`}
        </Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Chargement des zones...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <MapPin size={40} color={COLORS.grayMedium} />
            <Text style={styles.errorText}>Impossible de charger la carte</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webviewRef}
            source={{ html: buildHeatmapHTML(zones, false) }}
            style={styles.webview}
            scrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.white },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  refreshBtn:   { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '800', color: COLORS.black },
  subtitle:     { fontSize: 12, color: COLORS.grayMedium, fontWeight: '500', marginTop: 1 },
  legend:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
  legendText:   { fontSize: 12, fontWeight: '600', color: COLORS.grayMedium },
  legendSep:    { flex: 1 },
  legendCount:  { fontSize: 12, fontWeight: '700', color: COLORS.black },
  mapContainer: { flex: 1 },
  webview:      { flex: 1 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { fontSize: 14, color: COLORS.grayMedium },
  errorText:    { fontSize: 15, color: COLORS.grayMedium, fontWeight: '600', textAlign: 'center' },
  retryBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  retryText:    { color: COLORS.white, fontWeight: '700' },
});
