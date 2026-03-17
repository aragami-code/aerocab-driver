import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { theme } from '../../constants/theme';

/**
 * Skeleton loading placeholder for the active flight card.
 * Mimics: flight number + airline + airport info + time.
 */
export function FlightCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Skeleton width={100} height={18} borderRadius={4} />
        <Skeleton width={70} height={24} borderRadius={12} />
      </View>
      <Skeleton width={'90%' as unknown as number} height={14} borderRadius={4} />
      <View style={styles.row}>
        <Skeleton width={80} height={12} borderRadius={4} />
        <Skeleton width={60} height={12} borderRadius={4} />
      </View>
      <Skeleton width={160} height={14} borderRadius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.card,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
});
