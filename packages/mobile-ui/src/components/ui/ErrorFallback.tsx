import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { theme } from '../../constants/theme';

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

/**
 * Branded error fallback UI — shown when ErrorBoundary catches a crash.
 * Clean, professional look with retry button.
 */
export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <View style={styles.container}>
      <AlertTriangle size={56} color={theme.colors.warning} strokeWidth={1.5} />
      <Text style={styles.title}>Quelque chose s'est mal passé</Text>
      <Text style={styles.message}>
        Une erreur inattendue est survenue. Veuillez réessayer.
      </Text>
      {__DEV__ && error ? (
        <Text style={styles.errorDetail} numberOfLines={4}>
          {error.message}
        </Text>
      ) : null}
      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
        <RefreshCw size={18} color={theme.colors.white} strokeWidth={2} />
        <Text style={styles.buttonText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorDetail: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 16,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.button,
    marginTop: 28,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
