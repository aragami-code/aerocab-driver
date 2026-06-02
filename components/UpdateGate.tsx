import { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
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

  if (belowMin) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:24, gap:16 }}>
        <Text style={{ fontSize:18, fontWeight:'800' }}>Mise à jour requise</Text>
        <Text style={{ textAlign:'center', color:'#555' }}>Votre version est trop ancienne. Mettez à jour pour continuer.</Text>
        {progress !== null
          ? <Text>Téléchargement… {Math.round(progress*100)}%</Text>
          : <Pressable onPress={download} style={{ backgroundColor:'#1a56db', padding:14, borderRadius:12 }}>
              <Text style={{ color:'#fff', fontWeight:'700' }}>Mettre à jour</Text>
            </Pressable>}
      </View>
    );
  }

  return (
    <>
      {belowLatest && !dismissed && (
        <View style={{ backgroundColor:'#FFF8E1', padding:12, flexDirection:'row', alignItems:'center', gap:8 }}>
          <Text style={{ flex:1, color:'#7B5E00' }}>{progress !== null ? `Téléchargement… ${Math.round(progress*100)}%` : 'Une mise à jour est disponible.'}</Text>
          <Pressable onPress={download}><Text style={{ color:'#1a56db', fontWeight:'700' }}>Installer</Text></Pressable>
          <Pressable onPress={() => setDismissed(true)}><Text style={{ color:'#999' }}>✕</Text></Pressable>
        </View>
      )}
      {children}
    </>
  );
}
