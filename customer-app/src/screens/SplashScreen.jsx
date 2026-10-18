/**
 * Screen: CP-01A — Splash Screen
 * Traceability: PondFish Customer Mobile App UI Specification (Section 8)
 * Checks secure Android Keystore session and determines initial route.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors } from '../theme/colors';
import { getAuthTokens, clearAuthTokens } from '../services/auth-storage';
import { api } from '../services/api';

export default function SplashScreen({ onNavigate }) {
  const [error, setError] = useState(null);
  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);

  async function checkSession() {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    if (isMountedRef.current) {
      setError(null);
    }

    try {
      // 1. Read hardware-backed Android Keystore
      const stored = await getAuthTokens();

      if (!stored || !stored.token) {
        // No existing session -> go to phone authentication
        if (isMountedRef.current) {
          onNavigate('PHONE_AUTH');
        }
        return;
      }

      // 2. Validate session with PondFish backend
      try {
        const response = await api.getProfile(stored.token);
        const customer = response?.data;

        if (customer && customer.isProfileComplete) {
          if (isMountedRef.current) {
            onNavigate('HOME', { customer, token: stored.token });
          }
        } else {
          if (isMountedRef.current) {
            onNavigate('PROFILE_COMPLETION', { customer, token: stored.token });
          }
        }
      } catch (apiErr) {
        if (apiErr.status === 401) {
          // Token expired or revoked -> clear stale session and navigate to phone entry
          try {
            await clearAuthTokens();
          } catch (_) {}
          if (isMountedRef.current) {
            onNavigate('PHONE_AUTH');
          }
        } else {
          // Network failure or backend temporarily unreachable -> present retry without clearing credentials
          if (isMountedRef.current) {
            setError('Unable to connect to PondFish. Please check your connection and try again.');
            isCheckingRef.current = false;
          }
        }
      }
    } catch (e) {
      console.error('[SPLASH ERROR]', e);
      if (isMountedRef.current) {
        setError('We couldn’t start PondFish.');
        isCheckingRef.current = false;
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      checkSession();
    }, 600);
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Brand Logo Box */}
      <View style={styles.logoBox}>
        <Text style={styles.logoIcon}>🐟</Text>
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
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(2, 132, 199, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 40,
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
