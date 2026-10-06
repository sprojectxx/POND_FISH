/**
 * PondFish Customer Mobile Application Entry Point
 * Traceability: PondFish Customer Mobile App Specification (CP-01, CP-02, CP-03, CP-04, CP-05)
 * Orchestrates customer authentication state machine, secure storage, and authenticated navigation shell.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { colors } from './src/theme/colors';
import { api } from './src/services/api';

import SplashScreen from './src/screens/SplashScreen';
import PhoneAuthScreen from './src/screens/PhoneAuthScreen';
import OtpVerifyScreen from './src/screens/OtpVerifyScreen';
import ProfileCompletionScreen from './src/screens/ProfileCompletionScreen';
import HomeScreen from './src/screens/HomeScreen';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import FishDetailsScreen from './src/screens/FishDetailsScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import BookingConfirmationScreen from './src/screens/BookingConfirmationScreen';
import BookingHistoryScreen from './src/screens/BookingHistoryScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ScanBillScreen from './src/screens/ScanBillScreen';
import BillReviewScreen from './src/screens/BillReviewScreen';
import TransactionResultScreen from './src/screens/TransactionResultScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import LiveTrackingScreen from './src/screens/LiveTrackingScreen';

const AUTHENTICATED_SCREENS = [
  'HOME',
  'MARKETPLACE',
  'FISH_DETAILS',
  'CART',
  'CHECKOUT',
  'BOOKING_CONFIRMATION',
  'BOOKING_HISTORY',
  'SUBSCRIPTION',
  'NOTIFICATIONS',
  'SCAN_BILL',
  'BILL_REVIEW',
  'TRANSACTION_RESULT',
  'TRANSACTION_HISTORY',
  'LIVE_TRACKING',
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('SPLASH');
  const [screenParams, setScreenParams] = useState({});
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    try {
      const res = await api.getCart();
      if (res.data?.summary?.totalItems !== undefined) {
        setCartCount(res.data.summary.totalItems);
      }
    } catch {
      // Unauthenticated or network error; keep current cart count
    }
  }, []);

  // Update cart count when entering authenticated flow
  useEffect(() => {
    if (AUTHENTICATED_SCREENS.includes(currentScreen)) {
      fetchCartCount();
    }
  }, [currentScreen, fetchCartCount]);

  function handleNavigate(targetScreen, params = {}) {
    setScreenParams((prev) => ({ ...prev, ...params }));
    setCurrentScreen(targetScreen);
  }

  function handleCartUpdated(cartData) {
    if (cartData?.summary?.totalItems !== undefined) {
      setCartCount(cartData.summary.totalItems);
    } else if (Array.isArray(cartData?.items)) {
      setCartCount(cartData.items.length);
    }
  }

  const showBottomNav = AUTHENTICATED_SCREENS.includes(currentScreen);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      <View style={styles.screenContainer}>
        {currentScreen === 'SPLASH' && (
          <SplashScreen onNavigate={handleNavigate} />
        )}

        {currentScreen === 'PHONE_AUTH' && (
          <PhoneAuthScreen onNavigate={handleNavigate} />
        )}

        {currentScreen === 'OTP_VERIFY' && (
          <OtpVerifyScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'PROFILE_COMPLETION' && (
          <ProfileCompletionScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'HOME' && (
          <HomeScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
            cartCount={cartCount}
          />
        )}

        {currentScreen === 'MARKETPLACE' && (
          <MarketplaceScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
            cartCount={cartCount}
          />
        )}

        {currentScreen === 'FISH_DETAILS' && (
          <FishDetailsScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
            cartCount={cartCount}
            onCartUpdated={handleCartUpdated}
          />
        )}

        {currentScreen === 'CART' && (
          <CartScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
            onCartUpdated={handleCartUpdated}
          />
        )}

        {currentScreen === 'CHECKOUT' && (
          <CheckoutScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
            onCartUpdated={handleCartUpdated}
          />
        )}

        {currentScreen === 'BOOKING_CONFIRMATION' && (
          <BookingConfirmationScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'BOOKING_HISTORY' && (
          <BookingHistoryScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'SUBSCRIPTION' && (
          <SubscriptionScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'NOTIFICATIONS' && (
          <NotificationsScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'SCAN_BILL' && (
          <ScanBillScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'BILL_REVIEW' && (
          <BillReviewScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'TRANSACTION_RESULT' && (
          <TransactionResultScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'TRANSACTION_HISTORY' && (
          <TransactionHistoryScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}

        {currentScreen === 'LIVE_TRACKING' && (
          <LiveTrackingScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
          />
        )}
      </View>

      {/* Authenticated Global Bottom Navigation Bar */}
      {showBottomNav && (
        <View style={styles.bottomNav}>
          {/* Nav Item 1: Home */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleNavigate('HOME')}
            activeOpacity={0.7}
          >
            <Text style={[styles.navIcon, currentScreen === 'HOME' && styles.navIconActive]}>
              🏠
            </Text>
            <Text style={[styles.navLabel, currentScreen === 'HOME' && styles.navLabelActive]}>
              Home
            </Text>
          </TouchableOpacity>

          {/* Nav Item 2: Marketplace */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleNavigate('MARKETPLACE')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.navIcon,
                (currentScreen === 'MARKETPLACE' || currentScreen === 'FISH_DETAILS') &&
                  styles.navIconActive,
              ]}
            >
              🐟
            </Text>
            <Text
              style={[
                styles.navLabel,
                (currentScreen === 'MARKETPLACE' || currentScreen === 'FISH_DETAILS') &&
                  styles.navLabelActive,
              ]}
            >
              Marketplace
            </Text>
          </TouchableOpacity>

          {/* Nav Item 3: Cart */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleNavigate('CART')}
            activeOpacity={0.7}
          >
            <View style={styles.cartNavBox}>
              <Text
                style={[
                  styles.navIcon,
                  (currentScreen === 'CART' || currentScreen === 'CHECKOUT') &&
                    styles.navIconActive,
                ]}
              >
                🛒
              </Text>
              {cartCount > 0 && (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.navLabel,
                (currentScreen === 'CART' || currentScreen === 'CHECKOUT') &&
                  styles.navLabelActive,
              ]}
            >
              Cart
            </Text>
          </TouchableOpacity>

          {/* Nav Item 4: Bookings (QR Tickets) */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleNavigate('BOOKING_HISTORY')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.navIcon,
                (currentScreen === 'BOOKING_HISTORY' || currentScreen === 'BOOKING_CONFIRMATION') &&
                  styles.navIconActive,
              ]}
            >
              🎫
            </Text>
            <Text
              style={[
                styles.navLabel,
                (currentScreen === 'BOOKING_HISTORY' || currentScreen === 'BOOKING_CONFIRMATION') &&
                  styles.navLabelActive,
              ]}
            >
              Bookings
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  screenContainer: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 60,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.7,
  },
  navIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.accent,
  },
  cartNavBox: {
    position: 'relative',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.freshGreen,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
