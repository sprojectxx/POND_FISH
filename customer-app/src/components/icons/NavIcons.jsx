/**
 * PondFish Vector Navigation & Action Icons
 * Pure React Native View-based geometric vector icons.
 * Zero external SVG dependencies, zero native linking, 100% performant on Android/iOS.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../theme/tokens';

/**
 * Home / Storefront Icon
 */
export function HomeIcon({ size = 22, color = Colors.textMuted, focused = false }) {
  const strokeColor = focused ? Colors.brandNavy : color;
  const s = size;

  return (
    <View style={[styles.center, { width: s, height: s }]}>
      {/* Roof peak */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: s * 0.45,
          borderRightWidth: s * 0.45,
          borderBottomWidth: s * 0.35,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: strokeColor,
        }}
      />
      {/* Shop body */}
      <View
        style={{
          width: s * 0.72,
          height: s * 0.48,
          borderWidth: 1.8,
          borderColor: strokeColor,
          borderTopWidth: 0,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          backgroundColor: focused ? Colors.surfaceSubtle : 'transparent',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {/* Door */}
        <View
          style={{
            width: s * 0.24,
            height: s * 0.28,
            backgroundColor: strokeColor,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Track / Compass Icon
 */
export function TrackIcon({ size = 22, color = Colors.textMuted, focused = false }) {
  const strokeColor = focused ? Colors.brandNavy : color;
  const s = size;

  return (
    <View style={[styles.center, { width: s, height: s }]}>
      {/* Outer compass ring */}
      <View
        style={{
          width: s * 0.88,
          height: s * 0.88,
          borderRadius: (s * 0.88) / 2,
          borderWidth: 1.8,
          borderColor: strokeColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Compass needle */}
        <View
          style={{
            width: s * 0.16,
            height: s * 0.52,
            alignItems: 'center',
            justifyContent: 'space-between',
            transform: [{ rotate: '45deg' }],
          }}
        >
          {/* North needle tip */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: s * 0.1,
              borderRightWidth: s * 0.1,
              borderBottomWidth: s * 0.24,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: strokeColor,
            }}
          />
          {/* South needle tip */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: s * 0.1,
              borderRightWidth: s * 0.1,
              borderTopWidth: s * 0.24,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: focused ? strokeColor : Colors.borderMedium,
            }}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Scan Bill / Center Elevated Camera & Receipt Icon
 */
export function ScanBillIcon({ size = 24, color = Colors.textWhite, focused = false }) {
  const strokeColor = color;
  const s = size;

  return (
    <View style={[styles.center, { width: s, height: s }]}>
      {/* Scanner frame / viewfinder corners */}
      <View
        style={{
          width: s * 0.9,
          height: s * 0.82,
          borderWidth: 1.8,
          borderColor: strokeColor,
          borderRadius: 4,
          padding: 2,
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        {/* Receipt lines */}
        <View style={{ width: '70%', height: 1.6, backgroundColor: strokeColor, borderRadius: 1 }} />
        <View style={{ width: '50%', height: 1.6, backgroundColor: strokeColor, borderRadius: 1 }} />
        <View style={{ width: '60%', height: 1.6, backgroundColor: strokeColor, borderRadius: 1 }} />
      </View>
    </View>
  );
}

/**
 * Bookings / Calendar Ticket Icon
 */
export function BookingsIcon({ size = 22, color = Colors.textMuted, focused = false }) {
  const strokeColor = focused ? Colors.brandNavy : color;
  const s = size;

  return (
    <View style={[styles.center, { width: s, height: s }]}>
      {/* Calendar Top binder rings */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: s * 0.5, marginBottom: -2 }}>
        <View style={{ width: 2, height: 3.5, backgroundColor: strokeColor, borderRadius: 1 }} />
        <View style={{ width: 2, height: 3.5, backgroundColor: strokeColor, borderRadius: 1 }} />
      </View>
      {/* Calendar body */}
      <View
        style={{
          width: s * 0.82,
          height: s * 0.74,
          borderWidth: 1.8,
          borderColor: strokeColor,
          borderRadius: 4,
          backgroundColor: focused ? Colors.surfaceSubtle : 'transparent',
          overflow: 'hidden',
        }}
      >
        {/* Header stripe */}
        <View style={{ width: '100%', height: 4, backgroundColor: strokeColor }} />
        {/* Grid dots */}
        <View style={{ flex: 1, padding: 2, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center' }}>
          <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: strokeColor }} />
          <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: strokeColor }} />
          <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: strokeColor }} />
          <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: strokeColor }} />
        </View>
      </View>
    </View>
  );
}

/**
 * Profile / User Icon
 */
export function ProfileIcon({ size = 22, color = Colors.textMuted, focused = false }) {
  const strokeColor = focused ? Colors.brandNavy : color;
  const s = size;

  return (
    <View style={[styles.center, { width: s, height: s }]}>
      {/* User Head */}
      <View
        style={{
          width: s * 0.36,
          height: s * 0.36,
          borderRadius: (s * 0.36) / 2,
          borderWidth: 1.8,
          borderColor: strokeColor,
          backgroundColor: focused ? strokeColor : 'transparent',
          marginBottom: 1.5,
        }}
      />
      {/* User Shoulders / Torso */}
      <View
        style={{
          width: s * 0.72,
          height: s * 0.34,
          borderTopLeftRadius: s * 0.34,
          borderTopRightRadius: s * 0.34,
          borderWidth: 1.8,
          borderColor: strokeColor,
          borderBottomWidth: 0,
          backgroundColor: focused ? strokeColor : 'transparent',
        }}
      />
    </View>
  );
}

/**
 * Search Icon
 */
export function SearchIcon({ size = 18, color = Colors.textMuted }) {
  const s = size;
  return (
    <View style={[styles.center, { width: s, height: s }]}>
      {/* Circle lens */}
      <View
        style={{
          width: s * 0.68,
          height: s * 0.68,
          borderRadius: (s * 0.68) / 2,
          borderWidth: 1.8,
          borderColor: color,
          marginRight: s * 0.16,
          marginBottom: s * 0.16,
        }}
      />
      {/* Handle */}
      <View
        style={{
          position: 'absolute',
          right: 1,
          bottom: 2,
          width: s * 0.35,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * Location Pin Icon
 */
export function LocationPinIcon({ size = 18, color = Colors.actionGreen }) {
  const s = size;
  return (
    <View style={[styles.center, { width: s, height: s }]}>
      <View
        style={{
          width: s * 0.65,
          height: s * 0.65,
          borderRadius: (s * 0.65) / 2,
          borderBottomRightRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -s * 0.15,
        }}
      >
        {/* Center cutout */}
        <View
          style={{
            width: s * 0.22,
            height: s * 0.22,
            borderRadius: (s * 0.22) / 2,
            backgroundColor: Colors.surface,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Shopping Bag / Cart Icon
 */
export function CartIcon({ size = 20, color = Colors.textWhite }) {
  const s = size;
  return (
    <View style={[styles.center, { width: s, height: s }]}>
      {/* Bag handle */}
      <View
        style={{
          width: s * 0.42,
          height: s * 0.32,
          borderTopLeftRadius: (s * 0.42) / 2,
          borderTopRightRadius: (s * 0.42) / 2,
          borderWidth: 1.6,
          borderColor: color,
          borderBottomWidth: 0,
          marginBottom: -1,
        }}
      />
      {/* Bag body */}
      <View
        style={{
          width: s * 0.72,
          height: s * 0.58,
          borderWidth: 1.8,
          borderColor: color,
          borderRadius: 3,
          backgroundColor: 'transparent',
        }}
      />
    </View>
  );
}

/**
 * Stepper Plus Icon
 */
export function PlusIcon({ size = 14, color = Colors.actionGreen }) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={{ position: 'absolute', width: size * 0.8, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', height: size * 0.8, width: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

/**
 * Stepper Minus Icon
 */
export function MinusIcon({ size = 14, color = Colors.actionGreen }) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={{ width: size * 0.8, height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
