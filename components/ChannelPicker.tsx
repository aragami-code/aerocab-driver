import { View, Text, Pressable, StyleSheet } from 'react-native';

export type Channel = 'sms' | 'whatsapp' | 'email';
const META: Record<Channel, { label: string; icon: string }> = {
  sms:      { label: 'SMS',      icon: '💬' },
  whatsapp: { label: 'WhatsApp', icon: '🟢' },
  email:    { label: 'Email',    icon: '✉️' },
};

export function ChannelPicker({ channels, value, onChange }: {
  channels: Channel[]; value: Channel; onChange: (c: Channel) => void;
}) {
  if (!channels || channels.length <= 1) return null;
  return (
    <View style={styles.row}>
      {channels.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)}
          style={[styles.chip, value === c && styles.chipActive]}>
          <Text style={styles.icon}>{META[c].icon}</Text>
          <Text style={[styles.label, value === c && styles.labelActive]}>{META[c].label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { borderColor: '#1D2C4D', backgroundColor: 'rgba(29,44,77,0.06)' },
  icon: { fontSize: 20 },
  label: { fontSize: 12, color: '#64748b', marginTop: 4 },
  labelActive: { color: '#1D2C4D', fontWeight: '700' },
});
