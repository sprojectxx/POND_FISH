/**
 * Screen: CP-02 — Customer Home Dashboard Entry
 * Traceability: PondFish Customer Mobile App UI Specification (Section 14)
 * Post-authentication entry state showing customer profile, live truck status, and core actions.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { clearAuthTokens } from '../services/auth-storage';

export default function HomeScreen({ routeParams, onNavigate }) {
  const customer = routeParams?.customer || {};

  async function handleLogout() {
    try {
      // Clear credentials securely from Android Keystore
      await clearAuthTokens();
    } catch (e) {
      console.warn('[LOGOUT ERROR]', e);
    }
    onNavigate('PHONE_AUTH');
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top App Bar */}
        <View style={styles.appBar}>
          <View style={styles.brandRow}>
            <View style={styles.appIconBadge}>
              <Text style={{ fontSize: 18 }}>🐟</Text>
            </View>
            <View>
              <Text style={styles.brandText}>
                POND<Text style={{ color: colors.accent }}>FISH</Text>
              </Text>
              <Text style={styles.brandSub}>Bangalore Flagship Counter</Text>
            </View>
          </View>

          {/* Secure Logout Action */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* 1. Customer Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
            </Text>
          </View>
          <View style={styles.welcomeInfo}>
            <Text style={styles.greetingText}>Welcome,</Text>
            <Text style={styles.userName}>{customer.name || 'Valued Customer'}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaPill}>📱 +91 {customer.mobileNumber || ''}</Text>
              {Boolean(customer.area) && (
                <Text style={styles.metaPill}>📍 {customer.area}</Text>
              )}
            </View>
          </View>
        </View>

        {/* 2. Live Truck & Cold-Chain Status Banner */}
        <View style={styles.truckBanner}>
          <View style={styles.truckIconBox}>
            <Text style={{ fontSize: 24 }}>🚚</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.truckBadgeRow}>
              <View style={styles.liveDot} />
              <Text style={styles.truckBadgeText}>DAILY CATCH ARRIVED</Text>
            </View>
            <Text style={styles.truckTitle}>Morning Lake Replenishment Complete</Text>
            <Text style={styles.truckSubtitle}>
              Insulated transport arrived at 07:30 AM • 0–24h Green Peak Freshness
            </Text>
          </View>
        </View>

        {/* 3. Quick Action Grid */}
        <Text style={styles.sectionTitle}>Customer Services</Text>
        <View style={styles.actionGrid}>
          {/* Action 1: Catalogue */}
          <View style={styles.actionCard}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
              <Text style={{ fontSize: 24 }}>🐟</Text>
            </View>
            <Text style={styles.actionTitle}>Live Catch</Text>
            <Text style={styles.actionDesc}>Reserve whole fish or cuts online</Text>
          </View>

          {/* Action 2: Bill Scan */}
          <View style={styles.actionCard}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]}>
              <Text style={{ fontSize: 24 }}>🧾</Text>
            </View>
            <Text style={styles.actionTitle}>Scan Bill</Text>
            <Text style={styles.actionDesc}>Upload counter receipt & pay UPI</Text>
          </View>

          {/* Action 3: Subscriptions */}
          <View style={styles.actionCard}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
              <Text style={{ fontSize: 24 }}>💳</Text>
            </View>
            <Text style={styles.actionTitle}>Subscription</Text>
            <Text style={styles.actionDesc}>Weekly credits & discount tier</Text>
          </View>

          {/* Action 4: Live Delivery Tracking */}
          <View style={styles.actionCard}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(147, 51, 234, 0.15)' }]}>
              <Text style={{ fontSize: 24 }}>📍</Text>
            </View>
            <Text style={styles.actionTitle}>Live GPS</Text>
            <Text style={styles.actionDesc}>Track dedicated truck route</Text>
          </View>
        </View>

        {/* 4. Security & Keystore Notice */}
        <View style={styles.keystoreNotice}>
          <Text style={styles.keystoreTitle}>🛡️ Android Keystore Active</Text>
          <Text style={styles.keystoreDesc}>
            Your session credentials are encrypted in hardware storage. No plaintext secrets stored on device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  brandSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  welcomeCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  userAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  welcomeInfo: {
    flex: 1,
  },
  greetingText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  truckBanner: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 28,
  },
  truckIconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.freshGreen,
  },
  truckBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  truckTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  truckSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  keystoreNotice: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  keystoreTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 4,
  },
  keystoreDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
