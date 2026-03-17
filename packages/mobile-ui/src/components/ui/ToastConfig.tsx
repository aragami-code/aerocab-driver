import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle, XCircle, Info } from 'lucide-react-native';
import { theme } from '../../constants/theme';

/**
 * Custom toast config branded AeroCab.
 * Usage: <Toast config={toastConfig} /> in root _layout.tsx
 */
export const toastConfig = {
  success: ({ text1, text2 }: { text1?: string; text2?: string }) => (
    <View style={[styles.container, styles.success]}>
      <CheckCircle size={20} color={theme.colors.success} strokeWidth={2.2} />
      <View style={styles.textContainer}>
        {text1 ? <Text style={styles.title}>{text1}</Text> : null}
        {text2 ? <Text style={styles.message}>{text2}</Text> : null}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: { text1?: string; text2?: string }) => (
    <View style={[styles.container, styles.error]}>
      <XCircle size={20} color={theme.colors.error} strokeWidth={2.2} />
      <View style={styles.textContainer}>
        {text1 ? <Text style={styles.title}>{text1}</Text> : null}
        {text2 ? <Text style={styles.message}>{text2}</Text> : null}
      </View>
    </View>
  ),
  info: ({ text1, text2 }: { text1?: string; text2?: string }) => (
    <View style={[styles.container, styles.info]}>
      <Info size={20} color={theme.colors.primary} strokeWidth={2.2} />
      <View style={styles.textContainer}>
        {text1 ? <Text style={styles.title}>{text1}</Text> : null}
        {text2 ? <Text style={styles.message}>{text2}</Text> : null}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    minWidth: '85%',
  },
  success: {
    backgroundColor: '#F0FFF4',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  error: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  info: {
    backgroundColor: '#EBF8FF',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  message: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
