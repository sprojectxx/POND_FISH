/**
 * Screen: CP-01A — Splash Screen
 * Traceability: PondFish Customer Mobile App UI Specification (Section 8)
 * Checks secure Android Keystore session and determines initial route.
 * Phase 3B.2: Removed artificial 600ms delay to enable immediate startup session validation.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { colors } from '../theme/colors';
import { getAuthTokens, clearAuthTokens } from '../services/auth-storage';
import { api } from '../services/api';
import { orchestrateStartupSession } from '../utils/startup-session';

export default function SplashScreen({ onNavigate }) {
  const [error, setError] = useState(null);
  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);

  const checkSession = () => {
    return orchestrateStartupSession({
      getAuthTokens,
      clearAuthTokens,
      apiClient: api,
      onNavigate,
      setError,
      isCheckingRef,
      isMountedRef,
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    checkSession();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Brand Logo Box */}
      <View style={styles.logoBox}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.brandTitle}>
        POND<Text style={{ color: colors.accent }}>FISH</Text>
      </Text>
      <Text style={styles.tagline}>Fresh Lake Catch Daily</Text>
      <Text style={styles.subTagline}>Dedicated Cold-Chain to Bangalore Counter</Text>

      {/* Loading or Error State */}
      <View style={styles.statusContainer}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={checkSession}
              accessibilityRole="button"
              accessibilityLabel="Try Again"
              activeOpacity={0.75}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Initializing secure session...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 4,
  },
  subTagline: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  statusContainer: {
    marginTop: 48,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorBox: {
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
    maxWidth: 280,
  },
  retryButton: {
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
