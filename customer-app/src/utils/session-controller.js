/**
 * PondFish Customer Mobile App Session Controller
 * Production module governing session transitions, logout, and account isolation.
 * Traceability: Phase 3B.7A Security Remediation (CP-01, Section 8)
 * 
 * Used directly by App.jsx and automated test suites to guarantee
 * consistent, fail-closed production session lifecycle behavior.
 */

const LOGOUT_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  ABORTED_OBSOLETE: 'ABORTED_OBSOLETE',
  ALREADY_IN_PROGRESS: 'ALREADY_IN_PROGRESS',
};

/**
 * Executes a secure logout transition according to the PONDFISH security state machine:
 * 1. Concurrency control: Blocks overlapping logout attempts.
 * 2. Obsolete token detection: If expectedToken is provided, verifies stored token identity
 *    in the serialized storage queue. If the token changed (e.g. newer customer logged in),
 *    aborts without clearing newer credentials, request ownership, cache, or locking UI.
 * 3. Fail-closed credential clearance: Clears credentials and verified absent in Android Keystore.
 * 4. Immediate state & request invalidation: Cancels all in-flight requests belonging to the
 *    session across all HTTP methods via API_SESSION_RESET, invalidates response cache,
 *    and clears private in-memory customer data.
 * 5. Screen transition: Navigates to PHONE_AUTH on verified clearance, or locks on LOGOUT_FAILURE
 *    on any Keystore or credential reset failure.
 *
 * @param {Object} params
 * @param {string|null} [params.expectedToken] - Token identity to verify before clearing (e.g. from 401 callback)
 * @param {Object} params.authStorage - Auth storage module ({ getAuthTokens, clearAuthTokens, ... })
 * @param {Object} params.apiClient - API client module ({ resetSession, clearInFlightRequests, clearResponseCache })
 * @param {Function} [params.getState] - Returns current application state
 * @param {Function} [params.setState] - Updates application state
 * @param {Function} [params.onSessionInvalidated] - Callback when session ID increments
 * @param {{ current: boolean }} [params.isLoggingOutRef] - Concurrency ref
 * @returns {Promise<{ status: string, cleared: boolean, error?: Error }>}
 */
async function executeSessionLogout({
  expectedToken = null,
  authStorage,
  apiClient,
  getState,
  setState,
  onSessionInvalidated,
  isLoggingOutRef,
}) {
  if (isLoggingOutRef) {
    if (isLoggingOutRef.current) {
      return { status: LOGOUT_STATUS.ALREADY_IN_PROGRESS, cleared: false };
    }
    isLoggingOutRef.current = true;
  }

  try {
    // 1. Obsolete token pre-flight verification:
    // If expectedToken is supplied, verify against stored token in storage mutation queue.
    // If stored token no longer matches expectedToken, abort immediately without touching active session.
    if (expectedToken && typeof authStorage?.getAuthTokens === 'function') {
      try {
        const current = await authStorage.getAuthTokens();
        if (current?.token && current.token !== expectedToken) {
          console.warn('[SESSION CONTROLLER] Stored token does not match rejected token; aborting obsolete logout');
          return { status: LOGOUT_STATUS.ABORTED_OBSOLETE, cleared: false };
        }
      } catch (readErr) {
        // If storage read fails, proceed to clearAuthTokens which performs the authoritative queue check
      }
    }

    // 2. Visual feedback and state revocation for manual logout:
    // For intentional manual logout (expectedToken === null), immediately transition away
    // from authenticated screens to prevent viewing private customer data.
    if (!expectedToken && typeof setState === 'function') {
      setState({
        isAuthenticated: false,
        isProfileComplete: false,
        screenParams: {},
        cartSummary: { totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true },
        currentScreen: 'LOGOUT_IN_PROGRESS',
      });
    }

    let didClear = false;
    let clearError = null;

    try {
      if (typeof authStorage?.clearAuthTokens === 'function') {
        didClear = await authStorage.clearAuthTokens(expectedToken);
      }
      if (!didClear && expectedToken) {
        console.warn('[SESSION CONTROLLER] Storage clear rejected obsolete token; preserving active session');
        // Do NOT delete newer credentials, do NOT clear newer cache or request ownership,
        // and do NOT leave the UI stuck on LOGOUT_IN_PROGRESS.
        return { status: LOGOUT_STATUS.ABORTED_OBSOLETE, cleared: false };
      }
    } catch (err) {
      clearError = err;
      console.warn('[SESSION CONTROLLER] Error during clearAuthTokens', err);
    }

    // 3. Verification of credential deletion:
    if (didClear && !clearError) {
      // Invalidate session identity and cancel all in-flight requests belonging to old session
      if (typeof onSessionInvalidated === 'function') {
        onSessionInvalidated();
      }
      // Single-owner session invalidation: resetSession() internally cancels in-flight
      // requests and clears the response cache exactly once. If resetSession is unavailable,
      // fallback to clearInFlightRequests or clearResponseCache.
      if (typeof apiClient?.resetSession === 'function') {
        apiClient.resetSession();
      } else if (typeof apiClient?.clearInFlightRequests === 'function') {
        apiClient.clearInFlightRequests({ resetSession: true });
      } else if (typeof apiClient?.clearResponseCache === 'function') {
        apiClient.clearResponseCache();
      }

      if (typeof setState === 'function') {
        setState({
          isAuthenticated: false,
          isProfileComplete: false,
          screenParams: {},
          cartSummary: { totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true },
          logoutError: null,
          currentScreen: 'PHONE_AUTH',
        });
      }
      return { status: LOGOUT_STATUS.SUCCESS, cleared: true };
    } else {
      // Invariant: Credential clear failure or exception must NEVER be treated as successful logout.
      // Must fail closed: invalidate in-memory session, cancel in-flight requests, and lock UI on LOGOUT_FAILURE.
      if (typeof onSessionInvalidated === 'function') {
        onSessionInvalidated();
      }
      // Single-owner session invalidation: resetSession() internally cancels in-flight
      // requests and clears the response cache exactly once. If resetSession is unavailable,
      // fallback to clearInFlightRequests or clearResponseCache.
      if (typeof apiClient?.resetSession === 'function') {
        apiClient.resetSession();
      } else if (typeof apiClient?.clearInFlightRequests === 'function') {
        apiClient.clearInFlightRequests({ resetSession: true });
      } else if (typeof apiClient?.clearResponseCache === 'function') {
        apiClient.clearResponseCache();
      }

      const errorMsg = clearError?.message || 'Secure credential reset failed';
      if (typeof setState === 'function') {
        setState({
          isAuthenticated: false,
          isProfileComplete: false,
          screenParams: {},
          cartSummary: { totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true },
          logoutError: errorMsg,
          currentScreen: 'LOGOUT_FAILURE',
        });
      }
      return { status: LOGOUT_STATUS.FAILURE, cleared: false, error: clearError || new Error(errorMsg) };
    }
  } finally {
    if (isLoggingOutRef) {
      isLoggingOutRef.current = false;
    }
  }
}

module.exports = {
  LOGOUT_STATUS,
  executeSessionLogout,
};
