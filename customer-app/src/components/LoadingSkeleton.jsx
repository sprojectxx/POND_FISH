/**
 * Reusable Mobile Loading Skeleton Component
 * Traceability: PondFish Customer Mobile App UI Specification (Section 6.1)
 * Renders structural skeletons during API data retrieval.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.content}>
        <View style={styles.titleLine} />
        <View style={styles.subtitleLine} />
        <View style={styles.badgeLine} />
        <View style={styles.footerRow}>
          <View style={styles.priceLine} />
          <View style={styles.buttonPlaceholder} />
        </View>
      </View>
    </View>
  );
}

export default function LoadingSkeleton({ count = 3 }) {
  const items = Array.from({ length: count });
  return (
    <View style={styles.container}>
      {items.map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imagePlaceholder: {
    height: 140,
    backgroundColor: colors.bgSurface,
  },
  content: {
    padding: 14,
    gap: 10,
  },
  titleLine: {
    width: '65%',
    height: 16,
    backgroundColor: colors.bgSurface,
    borderRadius: 4,
  },
  subtitleLine: {
    width: '45%',
    height: 12,
    backgroundColor: colors.bgSurface,
    borderRadius: 4,
  },
  badgeLine: {
    width: '35%',
    height: 18,
    backgroundColor: colors.bgSurface,
    borderRadius: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  priceLine: {
    width: '30%',
    height: 18,
    backgroundColor: colors.bgSurface,
    borderRadius: 4,
  },
  buttonPlaceholder: {
    width: '30%',
    height: 32,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
  },
});
