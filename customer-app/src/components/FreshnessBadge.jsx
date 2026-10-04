/**
 * Reusable Mobile Freshness Badge Component
 * Traceability: PondFish Complete Design System (Freshness Indicator Specification)
 * Maps GREEN / GREY / RED states to visual badges.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function FreshnessBadge({ freshness, style }) {
  const state = freshness?.state || 'GREEN';
  const label = freshness?.label || 'Fresh Catch';

  let badgeColor = colors.freshGreen;
  let badgeBg = 'rgba(22, 163, 74, 0.15)';
  let dotColor = colors.freshGreen;

  if (state === 'GREY') {
    badgeColor = colors.freshGrey;
    badgeBg = 'rgba(100, 116, 139, 0.15)';
    dotColor = colors.freshGrey;
  } else if (state === 'RED') {
    badgeColor = colors.freshRed;
    badgeBg = 'rgba(220, 38, 38, 0.15)';
    dotColor = colors.freshRed;
  }

  return (
    <View style={[styles.badge, { backgroundColor: badgeBg }, style]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.text, { color: badgeColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
