import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Platform, Modal, Animated, PanResponder, StyleSheet } from 'react-native';
// SDK 55 : l'API « classique » (createDownloadResumable / getContentUriAsync /
// cacheDirectory) a été déplacée vers le sous-module `legacy`. La nouvelle API
// (File/Directory/Paths) n'expose pas createDownloadResumable, on importe donc
// explicitement la version legacy pour conserver le téléchargement avec progression.
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { useAnnouncementsStore } from '../stores/announcementsStore';

function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i]||0) !== (pb[i]||0)) return (pa[i]||0) - (pb[i]||0); }
  return 0;
}

// ── Bottom sheet de mise à jour (optionnelle) ────────────────────────────────
function UpdateSheet({ latest, progress, onInstall, onLater }: {
  latest: string; progress: number | null; onInstall: () => void; onLater: () => void;
}) {
  const translateY = useRef(new Animated.Value(400)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const downloading = progress !== null;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
    ]).start();
  }, []);

  const close = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 400, duration: 180, useNativeDriver: true }),
    ]).start(() => cb());
  };

  // Swipe-down pour ignorer (désactivé pendant le téléchargement)
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => !downloading && g.dy > 6,
      onPanResponderMove: (_e, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90) close(onLater);
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => !downloading && close(onLater)}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={{ flex: 1 }} onPress={() => !downloading && close(onLater)} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...pan.panHandlers}>
        <View style={styles.handle} />
        <View style={styles.row}>
          <View style={styles.iconBox}><Text style={styles.icon}>🚀</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mise à jour disponible</Text>
            <Text style={styles.version}>Version {latest}</Text>
          </View>
        </View>
        <Text style={styles.desc}>
          Une nouvelle version de l'application est prête : améliorations et corrections.
        </Text>

        {downloading ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]} />
            </View>
            <Text style={styles.progressTxt}>Téléchargement… {Math.round((progress ?? 0) * 100)}%</Text>
          </View>
        ) : (
          <>
            <Pressable onPress={onInstall} style={styles.cta}>
              <Text style={styles.ctaTxt}>Mettre à jour maintenant</Text>
            </Pressable>
            <Pressable onPress={() => close(onLater)} style={styles.later}>
              <Text style={styles.laterTxt}>Plus tard</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const version = useAnnouncementsStore(s => s.version);
  const [progress, setProgress] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const current = Application.nativeApplicationVersion ?? '0.0.0';

  if (!version) return <>{children}</>;
  const belowMin = cmpVersion(current, version.min) < 0;
  const belowLatest = cmpVersion(current, version.latest) < 0;

  const download = async () => {
    if (!version.apkUrl || Platform.OS !== 'android') return;
    try {
      const dest = FileSystem.cacheDirectory + 'update.apk';
      const dl = FileSystem.createDownloadResumable(version.apkUrl, dest, {}, (p) => {
        setProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      });
      const res = await dl.downloadAsync();
      if (res?.uri) {
        const contentUri = await FileSystem.getContentUriAsync(res.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
          data: contentUri, flags: 1,
        });
      }
    } finally {
      setProgress(null);
    }
  };

  // MAJ FORCÉE — écran plein bloquant
  if (belowMin) {
    return (
      <View style={styles.forced}>
        <View style={styles.iconBoxLg}><Text style={styles.iconLg}>🚀</Text></View>
        <Text style={styles.forcedTitle}>Mise à jour requise</Text>
        <Text style={styles.forcedDesc}>Votre version est trop ancienne. Mettez à jour pour continuer à utiliser l'application.</Text>
        {progress !== null ? (
          <View style={[styles.progressWrap, { width: '100%', maxWidth: 320 }]}>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
            <Text style={styles.progressTxt}>Téléchargement… {Math.round(progress * 100)}%</Text>
          </View>
        ) : (
          <Pressable onPress={download} style={[styles.cta, { maxWidth: 320, width: '100%' }]}>
            <Text style={styles.ctaTxt}>Mettre à jour</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // MAJ OPTIONNELLE — bottom sheet
  return (
    <>
      {children}
      {belowLatest && !dismissed && (
        <UpdateSheet latest={version.latest} progress={progress} onInstall={download} onLater={() => setDismissed(true)} />
      )}
    </>
  );
}

const PRIMARY = '#1D2C4D';
const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 20,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(29,44,77,0.08)', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 26 },
  title: { fontSize: 17, fontWeight: '800', color: PRIMARY },
  version: { fontSize: 13, color: '#64748b', marginTop: 2 },
  desc: { fontSize: 14, color: '#475569', lineHeight: 20, marginTop: 14, marginBottom: 18 },
  cta: { backgroundColor: PRIMARY, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  later: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  laterTxt: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  progressWrap: { marginTop: 6 },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: PRIMARY },
  progressTxt: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center' },
  forced: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 14, backgroundColor: '#fff' },
  iconBoxLg: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(29,44,77,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  iconLg: { fontSize: 36 },
  forcedTitle: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  forcedDesc: { textAlign: 'center', color: '#64748b', fontSize: 14, lineHeight: 20, maxWidth: 320 },
});
