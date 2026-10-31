/**
 * PondFish Customer Mobile Application Entry Point
 * Traceability: PondFish Customer Mobile App Specification (CP-01, CP-02, CP-03, CP-04, CP-05)
 * Orchestrates customer authentication state machine, secure storage, and authenticated navigation shell.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { colors } from './src/theme/colors';
import { api, setUnauthorizedHandler } from './src/services/api';
import { getAuthTokens, clearAuthTokens } from './src/services/auth-storage';

import SplashScreen from './src/screens/SplashScreen';
import PhoneAuthScreen from './src/screens/PhoneAuthScreen';
import OtpVerifyScreen from './src/screens/OtpVerifyScreen';
import ProfileCompletionScreen from './src/screens/ProfileCompletionScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HomeScreen from './src/screens/HomeScreen';
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
import { AUTHENTICATED_SCREENS, resolveNavigationDecision } from './src/utils/navigation-guard';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('SPLASH');
  const [screenParams, setScreenParams] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const isLoggingOutRef = useRef(false);

  const [cartSummary, setCartSummary] = useState({
    totalItems: 0,
    totalQuantity: 0,
    totalAmount: 0,
    isAllBookable: true,
  });
  const cartCount = cartSummary?.totalItems || 0;

  const isFetchingCartRef = useRef(false);

  const fetchCartSummary = useCallback(async () => {
    if (isFetchingCartRef.current) return;
    isFetchingCartRef.current = true;
    try {
      const res = await api.getCart();
      if (res.data?.summary) {
        setCartSummary(res.data.summary);
      }
    } catch {
      // Unauthenticated or network error; keep current cart summary
    } finally {
      isFetchingCartRef.current = false;
    }
  }, []);

  // Update cart count and summary when entering authenticated flow
  useEffect(() => {
    if (AUTHENTICATED_SCREENS.includes(currentScreen) && isProfileComplete && currentScreen !== 'PROFILE_COMPLETION') {
      fetchCartSummary();
    }
  }, [currentScreen, isProfileComplete, fetchCartSummary]);

  const handleLogout = useCallback(async (expectedToken = null) => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    let didClear = false;

    try {
      didClear = await clearAuthTokens(expectedToken);
      if (!didClear && expectedToken) {
        console.warn('[LOGOUT] Session token changed before clearing; aborting obsolete logout');
        return;
      }
    } catch (e) {
      console.warn('[LOGOUT] Error clearing tokens', e);
    } finally {
      isLoggingOutRef.current = false;
    }

    if (didClear || !expectedToken) {
      setIsAuthenticated(false);
      setIsProfileComplete(false);
      setScreenParams({});
      setCartSummary({ totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true });
      setCurrentScreen('PHONE_AUTH');
    }
  }, []);

  // Handle HTTP 401 unauthorized session expiration with token identity validation
  const handleUnauthorized = useCallback(async (rejectedToken) => {
    if (isLoggingOutRef.current) return;

    try {
      const current = await getAuthTokens();

      // If the customer has an active token in Keystore:
      if (current?.token) {
        // Safe handling for missing/unidentifiable tokens:
        // Do not let an unidentifiable 401 clear a known active session
        if (!rejectedToken) {
          console.warn('[AUTH] Ignored 401 without token while active session exists');
          return;
        }

        // Compare rejected token against current stored token
        if (rejectedToken !== current.token) {
          console.warn('[AUTH] Ignored 401 from obsolete session token');
          return;
        }
      }
    } catch (e) {
      console.warn('[AUTH] Error inspecting current auth tokens during 401 handling', e);
    }

    await handleLogout(rejectedToken);
  }, [handleLogout]);

  // Register shared API client HTTP 401 unauthorized session expiration listener
  useEffect(() => {
    setUnauthorizedHandler((rejectedToken) => {
      handleUnauthorized(rejectedToken);
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [handleUnauthorized]);

  function handleNavigate(targetScreen, params = {}) {
    const decision = resolveNavigationDecision(
      { currentScreen, isAuthenticated, isProfileComplete },
      targetScreen,
      params
    );

    if (decision.blocked) {
      console.warn(`[NAVIGATION GUARD] Blocked unauthenticated navigation to ${targetScreen}`);
      return;
    }

    if (decision.nextIsProfileComplete !== isProfileComplete) {
      setIsProfileComplete(decision.nextIsProfileComplete);
    }

    if (decision.redirected) {
      console.warn(`[ONBOARDING GATE] Blocked uncompleted profile navigation to ${targetScreen}`);
      if (decision.nextIsAuthenticated && !isAuthenticated) {
        setIsAuthenticated(true);
      }
      setScreenParams((prev) => ({ ...prev, ...params }));
      if (currentScreen !== 'PROFILE_COMPLETION') {
        setCurrentScreen('PROFILE_COMPLETION');
      }
      return;
    }

    if (decision.nextIsAuthenticated && !isAuthenticated) {
      setIsAuthenticated(true);
    }

    setScreenParams((prev) => ({ ...prev, ...params }));
    setCurrentScreen(decision.nextScreen);
  }

  // Intercept Android hardware back press to avoid escaping authenticated boundary or returning after logout
  useEffect(() => {
    const backAction = () => {
      if (currentScreen === 'PHONE_AUTH' || currentScreen === 'SPLASH') {
        BackHandler.exitApp();
        return true;
      }
      if (currentScreen === 'OTP_VERIFY') {
        setCurrentScreen('PHONE_AUTH');
        return true;
      }
      if (currentScreen === 'PROFILE_COMPLETION') {
        // Prevent bypassing profile completion to HOME (Task 1)
        BackHandler.exitApp();
        return true;
      }
      if (!isProfileComplete && AUTHENTICATED_SCREENS.includes(currentScreen)) {
        BackHandler.exitApp();
        return true;
      }
      if (currentScreen === 'CHECKOUT') {
        // Map hardware back from CHECKOUT to CART (Task 3)
        setCurrentScreen('CART');
        return true;
      }
      if (currentScreen === 'HOME') {
        BackHandler.exitApp();
        return true;
      }
      if (AUTHENTICATED_SCREENS.includes(currentScreen)) {
        setCurrentScreen('HOME');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentScreen, isProfileComplete]);

  const handleCartUpdated = useCallback((cartData) => {
    if (cartData?.summary) {
      setCartSummary(cartData.summary);
    } else if (Array.isArray(cartData?.items)) {
      setCartSummary((prev) => ({
        ...prev,
        totalItems: cartData.items.length,
      }));
    }
  }, []);

  // Hide bottom navigation during initial auth, splash, mandatory profile completion, and checkout/details flows
  const showBottomNav = AUTHENTICATED_SCREENS.includes(currentScreen) &&
    isProfileComplete &&
    currentScreen !== 'SPLASH' &&
    currentScreen !== 'PHONE_AUTH' &&
    currentScreen !== 'OTP_VERIFY' &&
    currentScreen !== 'PROFILE_COMPLETION' &&
    currentScreen !== 'FISH_DETAILS' &&
    currentScreen !== 'CHECKOUT' &&
    currentScreen !== 'CART';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1C33" />

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

        {currentScreen === 'PROFILE' && (
          <ProfileScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        )}

        {currentScreen === 'HOME' && (
          <HomeScreen
            routeParams={screenParams}
            onNavigate={handleNavigate}
            cartCount={cartCount}
            cartSummary={cartSummary}
            onCartUpdated={handleCartUpdated}
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

      {/* Authenticated Global 5-Tab Bottom Navigation Bar */}
      {showBottomNav && (
        <View style={styles.bottomNavWrapper}>
          <View style={styles.bottomNav}>
            {/* Nav Item 1: Home */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => handleNavigate('HOME')}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, currentScreen === 'HOME' && styles.navIconActive]}>
                🏪
              </Text>
              <Text style={[styles.navLabel, currentScreen === 'HOME' && styles.navLabelActive]}>
                Home
              </Text>
            </TouchableOpacity>

            {/* Nav Item 2: Track */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => handleNavigate('LIVE_TRACKING')}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, currentScreen === 'LIVE_TRACKING' && styles.navIconActive]}>
                🧭
              </Text>
              <Text style={[styles.navLabel, currentScreen === 'LIVE_TRACKING' && styles.navLabelActive]}>
                Track
              </Text>
            </TouchableOpacity>

            {/* Nav Item 3: Center Elevated Scan Bill */}
            <TouchableOpacity
              style={styles.scanNavItem}
              onPress={() => handleNavigate('SCAN_BILL')}
              activeOpacity={0.85}
            >
              <View style={[styles.scanIconCircle, currentScreen === 'SCAN_BILL' && styles.scanIconCircleActive]}>
                <Text style={styles.scanIconText}>▣</Text>
              </View>
              <Text style={[styles.navLabel, currentScreen === 'SCAN_BILL' && styles.navLabelActive, { marginTop: 2 }]}>
                Scan Bill
              </Text>
            </TouchableOpacity>

            {/* Nav Item 4: Bookings */}
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
                📅
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

            {/* Nav Item 5: Profile */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => handleNavigate('PROFILE')}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, currentScreen === 'PROFILE' && styles.navIconActive]}>
                👤
              </Text>
              <Text style={[styles.navLabel, currentScreen === 'PROFILE' && styles.navLabelActive]}>
                Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A192F',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bottomNavWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 62,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  scanNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  scanIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0D2040',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  scanIconCircleActive: {
    backgroundColor: '#0284C7',
  },
  scanIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.65,
    marginBottom: 2,
  },
  navIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  navLabelActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
});
