import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonCircle } from '../ui/Skeleton';
import { theme } from '../../constants/theme';

/**
 * Skeleton loading placeholder for a driver card.
 * Mimics: avatar circle + 3 text lines + badges row.
 */
export function DriverCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonCircle size={56} />
      <View style={styles.content}>
        <Skeleton width={140} height={16} borderRadius={4} />
        <Skeleton width={100} height={12} borderRadius={4} />
        <View style={styles.badges}>
          <Skeleton width={60} height={20} borderRadius={10} />
          <Skeleton width={50} height={20} borderRadius={10} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.card,
    gap: 12,
    marginBottom: 12,
  },
  content: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
