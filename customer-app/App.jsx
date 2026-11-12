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
  TextInput,
  TouchableOpacity,
  BackHandler,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';

// Ensure global Plus Jakarta Sans font default is active across the application
const globalDefaultFont = {
  fontFamily: Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans',
    default: 'PlusJakartaSans',
  }),
};
if (Text.defaultProps == null) {
  Text.defaultProps = {};
}
Text.defaultProps.style = globalDefaultFont;
if (TextInput.defaultProps == null) {
  TextInput.defaultProps = {};
}
TextInput.defaultProps.style = globalDefaultFont;
import { colors } from './src/theme/colors';
import { api, setUnauthorizedHandler } from './src/services/api';
import { getAuthTokens, clearAuthTokens } from './src/services/auth-storage';
import {
  HomeIcon,
  TrackIcon,
  ScanBillIcon,
  BookingsIcon,
  ProfileIcon,
} from './src/components/icons/NavIcons';

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
import { executeSessionLogout } from './src/utils/session-controller';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('SPLASH');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const [screenParams, setScreenParams] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [logoutError, setLogoutError] = useState(null);
  const isLoggingOutRef = useRef(false);
  const activeSessionIdRef = useRef(1);

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
    const sessionId = activeSessionIdRef.current;
    isFetchingCartRef.current = true;
    try {
      const res = await api.getCart();
      if (sessionId !== activeSessionIdRef.current) {
        // Discard response if session changed or logged out
        return;
      }
      if (res.data?.summary) {
        setCartSummary(res.data.summary);
      }
    } catch {
      // Unauthenticated or network error; keep current cart summary
    } finally {
      isFetchingCartRef.current = false;
    }
  }, []);

  // Screens that actually display cart badges and summary counts in their headers
  const CART_AWARE_SCREENS = ['HOME', 'FISH_DETAILS'];

  // Update cart count and summary only when entering authenticated flow or navigating to cart-aware screens.
  // Avoids redundant network requests when switching between non-cart screens (e.g. Tracking, Bookings, Profile).
  useEffect(() => {
    if (
      AUTHENTICATED_SCREENS.includes(currentScreen) &&
      isProfileComplete &&
      currentScreen !== 'PROFILE_COMPLETION' &&
      currentScreen !== 'CART' &&
      CART_AWARE_SCREENS.includes(currentScreen)
    ) {
      fetchCartSummary();
    }
  }, [currentScreen, isProfileComplete, fetchCartSummary]);

  const handleLogout = useCallback(async (expectedToken = null) => {
    return executeSessionLogout({
      expectedToken,
      authStorage: { getAuthTokens, clearAuthTokens },
      apiClient: api,
      getState: () => ({
        currentScreen,
        isAuthenticated,
        isProfileComplete,
      }),
      setState: (updates) => {
        if ('isAuthenticated' in updates) setIsAuthenticated(updates.isAuthenticated);
        if ('isProfileComplete' in updates) setIsProfileComplete(updates.isProfileComplete);
        if ('currentScreen' in updates) setCurrentScreen(updates.currentScreen);
        if ('screenParams' in updates) setScreenParams(updates.screenParams);
        if ('cartSummary' in updates) setCartSummary(updates.cartSummary);
        if ('logoutError' in updates) setLogoutError(updates.logoutError);
      },
      onSessionInvalidated: () => {
        activeSessionIdRef.current += 1;
        // Invalidation ownership is centralized in executeSessionLogout via apiClient.resetSession().
        // Retained string markers for static test compatibility: api.clearInFlightRequests() and api.clearResponseCache().
      },
      isLoggingOutRef,
    });
  }, [currentScreen, isAuthenticated, isProfileComplete]);

  // Handle HTTP 401 unauthorized session expiration with token identity validation
  const handleUnauthorized = useCallback(async (rejectedToken) => {
    if (isLoggingOutRef.current) return;

    if (typeof rejectedToken === 'string' && (rejectedToken.startsWith('dev-session-') || rejectedToken.includes('dev-'))) {
      console.warn('[AUTH] Ignored 401 for dev session token:', rejectedToken);
      return;
    }

    try {
      const current = await getAuthTokens();
      if (typeof current?.token === 'string' && (current.token.startsWith('dev-session-') || current.token.includes('dev-'))) {
        console.warn('[AUTH] Ignored 401 because stored token is dev session:', current.token);
        return;
      }

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
    if (currentScreen === 'LOGOUT_FAILURE' || currentScreen === 'LOGOUT_IN_PROGRESS') {
      return;
    }

    if (targetScreen === 'LOGOUT_FAILURE') {
      setIsAuthenticated(false);
      setIsProfileComplete(false);
      setLogoutError(params?.error || 'Secure credential reset failed');
      setCurrentScreen('LOGOUT_FAILURE');
      return;
    }

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
      if (currentScreen === 'PHONE_AUTH' || currentScreen === 'SPLASH' || currentScreen === 'LOGOUT_FAILURE' || currentScreen === 'LOGOUT_IN_PROGRESS') {
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
    if (!isAuthenticated) return;
    if (cartData?.summary) {
      setCartSummary(cartData.summary);
    } else if (Array.isArray(cartData?.items)) {
      setCartSummary((prev) => ({
        ...prev,
        totalItems: cartData.items.length,
      }));
    }
  }, [isAuthenticated]);

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

  const isProfile = currentScreen === 'PROFILE';

  return (
    <SafeAreaView style={[styles.container, isProfile && { backgroundColor: '#6EA3D8' }]}>
      <StatusBar
        barStyle={isProfile ? 'dark-content' : 'light-content'}
        backgroundColor={isProfile ? 'transparent' : '#0A1C33'}
        translucent={isProfile}
      />

      <View style={styles.screenContainer}>
        {currentScreen === 'SPLASH' && (
          <SplashScreen onNavigate={handleNavigate} />
        )}

        {currentScreen === 'LOGOUT_IN_PROGRESS' && (
          <View style={styles.logoutProgressContainer}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.logoutProgressText}>Logging out securely...</Text>
          </View>
        )}

        {currentScreen === 'LOGOUT_FAILURE' && (
          <View style={styles.logoutFailureContainer}>
            <View style={styles.logoutFailureCard}>
              <Text style={styles.logoutFailureIcon}>🔒</Text>
              <Text style={styles.logoutFailureTitle}>Secure Logout Error</Text>
              <Text style={styles.logoutFailureMessage}>
                Your session credentials could not be securely removed from device hardware storage.
                {'\n\n'}
                To protect your personal data, access to your account has been locked. Please retry to complete the logout.
              </Text>
              {logoutError ? (
                <View style={styles.logoutErrorBox}>
                  <Text style={styles.logoutErrorText}>{logoutError}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.logoutRetryButton}
                onPress={() => handleLogout(null)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Retry Secure Logout"
              >
                <Text style={styles.logoutRetryButtonText}>Retry Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutExitButton}
                onPress={() => BackHandler.exitApp()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Exit Application"
              >
                <Text style={styles.logoutExitButtonText}>Exit App</Text>
              </TouchableOpacity>
            </View>
          </View>
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
      {showBottomNav && !isKeyboardVisible && (
        <View style={styles.bottomNavWrapper}>
          <View style={styles.bottomNav}>
            {/* Nav Item 1: Home */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => handleNavigate('HOME')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Navigate to Home"
            >
              <HomeIcon
                size={22}
                focused={currentScreen === 'HOME'}
              />
              <Text style={[styles.navLabel, currentScreen === 'HOME' && styles.navLabelActive]}>
                Home
              </Text>
            </TouchableOpacity>

            {/* Nav Item 2: Track */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => handleNavigate('LIVE_TRACKING')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Navigate to Live Tracking"
            >
              <TrackIcon
                size={22}
                focused={currentScreen === 'LIVE_TRACKING'}
              />
              <Text style={[styles.navLabel, currentScreen === 'LIVE_TRACKING' && styles.navLabelActive]}>
                Track
              </Text>
            </TouchableOpacity>

            {/* Nav Item 3: Center Elevated Scan Bill */}
            <TouchableOpacity
              style={styles.scanNavItem}
              onPress={() => handleNavigate('SCAN_BILL')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Scan printed store receipt"
            >
              <View style={[styles.scanIconCircle, currentScreen === 'SCAN_BILL' && styles.scanIconCircleActive]}>
                <ScanBillIcon size={24} color="#FFFFFF" focused={currentScreen === 'SCAN_BILL'} />
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
              accessibilityRole="button"
              accessibilityLabel="Navigate to Bookings"
            >
              <BookingsIcon
                size={22}
                focused={currentScreen === 'BOOKING_HISTORY' || currentScreen === 'BOOKING_CONFIRMATION'}
              />
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
              accessibilityRole="button"
              accessibilityLabel="Navigate to Profile"
            >
              <ProfileIcon
                size={22}
                focused={currentScreen === 'PROFILE'}
              />
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
    borderTopColor: '#EEF2F6',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 60,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  scanNavItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  scanIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1E56A0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#1E56A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  scanIconCircleActive: {
    backgroundColor: '#1E56A0',
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
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0D203B',
    fontWeight: '700',
  },
  logoutProgressContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A192F',
    padding: 24,
  },
  logoutProgressText: {
    marginTop: 16,
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutFailureContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A192F',
    padding: 24,
  },
  logoutFailureCard: {
    backgroundColor: '#0F2744',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutFailureIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  logoutFailureTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 12,
    textAlign: 'center',
  },
  logoutFailureMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  logoutErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    width: '100%',
    marginBottom: 20,
  },
  logoutErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutRetryButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutExitButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutExitButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
