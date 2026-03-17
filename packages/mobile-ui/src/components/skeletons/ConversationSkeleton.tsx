import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonCircle } from '../ui/Skeleton';
import { theme } from '../../constants/theme';

/**
 * Skeleton loading placeholder for a conversation card.
 * Mimics: avatar + name + last message preview + timestamp.
 */
export function ConversationSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonCircle size={48} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Skeleton width={120} height={14} borderRadius={4} />
          <Skeleton width={40} height={10} borderRadius={4} />
        </View>
        <Skeleton width={'80%' as unknown as number} height={12} borderRadius={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
