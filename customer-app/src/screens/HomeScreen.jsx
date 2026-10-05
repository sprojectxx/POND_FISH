/**
 * Screen: CP-02 — Customer Home Dashboard Entry
 * Traceability: PondFish Customer Mobile App UI Specification (Section 14-23)
 * Dynamic authenticated home consuming profile, live truck status, today's catch preview,
 * and entry points into Fish Marketplace & Cart.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { clearAuthTokens } from '../services/auth-storage';
import { api } from '../services/api';
import FreshnessBadge from '../components/FreshnessBadge';
import CartBadgeButton from '../components/CartBadgeButton';

export default function HomeScreen({ routeParams = {}, onNavigate, cartCount = 0 }) {
  const customer = routeParams?.customer || {};
  const [todayFish, setTodayFish] = useState([]);
  const [loadingFish, setLoadingFish] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fishError, setFishError] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchTodayFish = useCallback(async () => {
    try {
      setFishError(null);
      const res = await api.getFish({ availability: true });
      setTodayFish(res.data ? res.data.slice(0, 4) : []);
    } catch (err) {
      console.warn('[HOME TODAY FISH ERROR]', err.message);
      setFishError(err.message || 'Unable to load today’s catch.');
    } finally {
      setLoadingFish(false);
      setRefreshing(false);
    }

    try {
      const notifRes = await api.getNotifications({ limit: 1 });
      if (notifRes?.data?.unreadCount !== undefined) {
        setUnreadNotificationsCount(notifRes.data.unreadCount);
      }
    } catch {
      // Notification count error is non-blocking
    }
  }, []);

  useEffect(() => {
    fetchTodayFish();
  }, [fetchTodayFish]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTodayFish();
  }, [fetchTodayFish]);

  async function handleLogout() {
    try {
      await clearAuthTokens();
    } catch (e) {
      console.warn('[LOGOUT ERROR]', e);
    }
    onNavigate('PHONE_AUTH');
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.primary]}
          />
        }
      >
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={styles.notifButton}
              onPress={() => onNavigate('NOTIFICATIONS')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18 }}>🔔</Text>
              {unreadNotificationsCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <CartBadgeButton count={cartCount} onPress={() => onNavigate('CART')} />
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={styles.logoutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
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
              {Boolean(customer.area) && <Text style={styles.metaPill}>📍 {customer.area}</Text>}
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

        {/* 3. Today's Fresh Fish Preview Section (CP-02 Section 18) */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Today's Fresh Catch</Text>
            <Text style={styles.sectionSubtitle}>Direct lake harvest available now</Text>
          </View>
          <TouchableOpacity
            style={styles.seeAllButton}
            onPress={() => onNavigate('MARKETPLACE')}
            activeOpacity={0.7}
          >
            <Text style={styles.seeAllButtonText}>Marketplace →</Text>
          </TouchableOpacity>
        </View>

        {loadingFish ? (
          <View style={styles.previewLoadingBox}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.previewLoadingText}>Loading fresh arrivals...</Text>
          </View>
        ) : fishError ? (
          <View style={styles.previewErrorBox}>
            <Text style={styles.previewErrorText}>Unable to load fresh catch preview.</Text>
            <TouchableOpacity onPress={fetchTodayFish}>
              <Text style={styles.previewRetryText}>Tap to Retry</Text>
            </TouchableOpacity>
          </View>
        ) : todayFish.length === 0 ? (
          <View style={styles.previewEmptyBox}>
            <Text style={styles.previewEmptyText}>No fish currently listed in store today.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalFishScroll}
          >
            {todayFish.map((item) => {
              const effectivePrice = item.pricing ? item.pricing.effectivePrice : item.unitPrice;
              const hasDiscount = item.pricing && item.pricing.hasDiscount;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.previewFishCard}
                  onPress={() => onNavigate('FISH_DETAILS', { fishId: item.id, fish: item })}
                  activeOpacity={0.8}
                >
                  <View style={styles.previewImageBox}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.previewImage} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 30 }}>🐟</Text>
                    )}
                    {hasDiscount && (
                      <View style={styles.previewDiscountBadge}>
                        <Text style={styles.previewDiscountText}>
                          {item.pricing.discount?.percent ? `${item.pricing.discount.percent}% OFF` : 'DEAL'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.previewCardBody}>
                    <FreshnessBadge freshness={item.freshness} style={{ marginBottom: 4 }} />
                    <Text style={styles.previewFishName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.previewPriceRow}>
                      <Text style={styles.previewPrice}>₹{effectivePrice}/kg</Text>
                      {item.onlineBookable ? (
                        <Text style={styles.bookableTag}>⚡ Bookable</Text>
                      ) : (
                        <Text style={styles.inStoreTag}>Counter Only</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* 4. Quick Action Grid */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Customer Services</Text>
        <View style={styles.actionGrid}>
          {/* Action 1: Catalogue (Clickable to Marketplace) */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => onNavigate('MARKETPLACE')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
              <Text style={{ fontSize: 24 }}>🐟</Text>
            </View>
            <Text style={styles.actionTitle}>Fish Marketplace</Text>
            <Text style={styles.actionDesc}>Browse catalogue & reserve cuts online</Text>
          </TouchableOpacity>

          {/* Action 2: Cart */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => onNavigate('CART')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]}>
              <Text style={{ fontSize: 24 }}>🛒</Text>
            </View>
            <Text style={styles.actionTitle}>My Cart</Text>
            <Text style={styles.actionDesc}>
              {cartCount > 0 ? `${cartCount} items in cart` : 'View reserved selections'}
            </Text>
          </TouchableOpacity>

          {/* Action 3: Subscriptions */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => onNavigate('SUBSCRIPTION')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
              <Text style={{ fontSize: 24 }}>💳</Text>
            </View>
            <Text style={styles.actionTitle}>Subscription</Text>
            <Text style={styles.actionDesc}>Weekly credits & discount tier</Text>
          </TouchableOpacity>

          {/* Action 4: Bill Scan */}
          <View style={styles.actionCard}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(147, 51, 234, 0.15)' }]}>
              <Text style={{ fontSize: 24 }}>🧾</Text>
            </View>
            <Text style={styles.actionTitle}>Scan Bill</Text>
            <Text style={styles.actionDesc}>Counter receipt upload</Text>
          </View>
        </View>

        {/* 5. Security & Hardware Notice */}
        <View style={styles.keystoreNotice}>
          <Text style={styles.keystoreTitle}>🛡️ Android Keystore Active</Text>
          <Text style={styles.keystoreDesc}>
            Your session credentials are encrypted in hardware storage. All pricing and booking
            eligibility authoritative from PondFish backend.
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
    padding: 16,
    paddingBottom: 40,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
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
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutButtonText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  notifButton: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: colors.accent,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
  },
  welcomeCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
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
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaPill: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  truckBanner: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  truckIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
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
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  truckSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  seeAllButton: {
    paddingVertical: 4,
  },
  seeAllButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  previewLoadingBox: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  previewLoadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  previewErrorBox: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    gap: 6,
  },
  previewErrorText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  previewRetryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  previewEmptyBox: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
  },
  previewEmptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  horizontalFishScroll: {
    gap: 12,
    paddingRight: 16,
  },
  previewFishCard: {
    width: 170,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  previewImageBox: {
    width: '100%',
    height: 100,
    backgroundColor: colors.bgSurface,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewDiscountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.freshRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewDiscountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  previewCardBody: {
    padding: 10,
  },
  previewFishName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  previewPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  previewPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  bookableTag: {
    fontSize: 9,
    color: colors.accent,
    fontWeight: '700',
  },
  inStoreTag: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
    marginTop: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 14,
  },
  keystoreNotice: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
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
    lineHeight: 15,
  },
});
