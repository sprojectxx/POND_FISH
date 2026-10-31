/**
 * Navigation Guard and Onboarding Gate Helper
 * Traceability: Customer App Specification (CP-01 - CP-05) & Phase 3B.2
 * 
 * Pure production helper for resolving screen transitions, enforcing authentication guards,
 * and maintaining the mandatory profile-completion onboarding gate.
 */

const AUTHENTICATED_SCREENS = [
  'HOME',
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
  'PROFILE',
  'PROFILE_COMPLETION',
];

/**
 * Resolves next navigation state given current session state and requested target.
 * 
 * @param {Object} currentState
 * @param {string} currentState.currentScreen
 * @param {boolean} currentState.isAuthenticated
 * @param {boolean} currentState.isProfileComplete
 * @param {string} targetScreen
 * @param {Object} [params]
 * @returns {{
 *   blocked: boolean,
 *   redirected: boolean,
 *   nextScreen: string,
 *   nextIsAuthenticated: boolean,
 *   nextIsProfileComplete: boolean,
 * }}
 */
function resolveNavigationDecision(
  { currentScreen, isAuthenticated, isProfileComplete },
  targetScreen,
  params = {}
) {
  const resolvedScreen = targetScreen === 'MARKETPLACE' ? 'HOME' : targetScreen;
  const isTargetAuthenticated = AUTHENTICATED_SCREENS.includes(resolvedScreen);
  const isExplicitAuthTransition = Boolean(params?.token || params?.customer);

  // Stale requests cannot navigate the customer back into authenticated screens after logout
  if (isTargetAuthenticated && !isAuthenticated && !isExplicitAuthTransition) {
    return {
      blocked: true,
      redirected: false,
      nextScreen: currentScreen,
      nextIsAuthenticated: isAuthenticated,
      nextIsProfileComplete: isProfileComplete,
    };
  }

  // Authoritative profile-completion state tracking from genuine backend customer payload
  let nextProfileComplete = isProfileComplete;
  if (params?.customer && typeof params.customer.isProfileComplete === 'boolean') {
    nextProfileComplete = params.customer.isProfileComplete;
  }

  // Centralized onboarding gate:
  // Any screen in AUTHENTICATED_SCREENS except PROFILE_COMPLETION requires isProfileComplete === true
  const isProtectedScreen = isTargetAuthenticated && resolvedScreen !== 'PROFILE_COMPLETION';
  if (isProtectedScreen && !nextProfileComplete) {
    return {
      blocked: false,
      redirected: true,
      nextScreen: 'PROFILE_COMPLETION',
      nextIsAuthenticated: isExplicitAuthTransition ? true : isAuthenticated,
      nextIsProfileComplete: nextProfileComplete,
    };
  }

  return {
    blocked: false,
    redirected: false,
    nextScreen: resolvedScreen,
    nextIsAuthenticated: isExplicitAuthTransition ? true : isAuthenticated,
    nextIsProfileComplete: nextProfileComplete,
  };
}

module.exports = {
  AUTHENTICATED_SCREENS,
  resolveNavigationDecision,
};

