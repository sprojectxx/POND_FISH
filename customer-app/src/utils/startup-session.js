/**
 * Customer Application Startup Session Orchestrator
 * Traceability: Phase 3B.2 Splash Screen & First-Content Loading Optimization
 * 
 * Orchestrates secure session validation during application startup:
 * 1. Reads hardware-backed Android Keystore for existing credentials.
 * 2. If no credentials exist, transitions immediately to PHONE_AUTH.
 * 3. If credentials exist, validates session with backend (api.getProfile).
 * 4. On valid session, transitions to HOME (if profile complete) or PROFILE_COMPLETION.
 * 5. On HTTP 401 (expired/revoked), clears stale credentials and transitions to PHONE_AUTH.
 * 6. On network failure, preserves credentials and surfaces retry state.
 * 7. Enforces concurrency protection (isCheckingRef) and unmount protection (isMountedRef).
 */

async function orchestrateStartupSession({
  getAuthTokens,
  clearAuthTokens,
  apiClient,
  onNavigate,
  setError,
  isCheckingRef,
  isMountedRef,
}) {
  // Prevent duplicate concurrent execution
  if (isCheckingRef?.current) {
    return null;
  }
  if (isCheckingRef) {
    isCheckingRef.current = true;
  }

  // Clear previous error if mounted
  if (isMountedRef?.current && typeof setError === 'function') {
    setError(null);
  }

  try {
    // 1. Read hardware-backed Android Keystore
    const stored = await getAuthTokens();

    // Check mount state after async Keystore read
    if (isMountedRef && !isMountedRef.current) {
      return null;
    }

    if (!stored || !stored.token) {
      // No existing session -> transition to phone authentication
      if (isMountedRef?.current && typeof onNavigate === 'function') {
        onNavigate('PHONE_AUTH');
      }
      return { destination: 'PHONE_AUTH' };
    }

    // 2. Validate session with PondFish backend
    try {
      const response = await apiClient.getProfile(stored.token);
      const customer = response?.data;

      // Check mount state after async API call
      if (isMountedRef && !isMountedRef.current) {
        return null;
      }

      if (customer && customer.isProfileComplete) {
        if (isMountedRef?.current && typeof onNavigate === 'function') {
          onNavigate('HOME', { customer, token: stored.token });
        }
        return { destination: 'HOME', customer, token: stored.token };
      } else {
        if (isMountedRef?.current && typeof onNavigate === 'function') {
          onNavigate('PROFILE_COMPLETION', { customer, token: stored.token });
        }
        return { destination: 'PROFILE_COMPLETION', customer, token: stored.token };
      }
    } catch (apiErr) {
      // Check mount state after async error
      if (isMountedRef && !isMountedRef.current) {
        return null;
      }

      if (apiErr?.status === 401) {
        // Token expired or revoked -> clear stale session and navigate to phone entry
        try {
          if (typeof clearAuthTokens === 'function') {
            await clearAuthTokens();
          }
        } catch (_) {}

        if (isMountedRef?.current && typeof onNavigate === 'function') {
          onNavigate('PHONE_AUTH');
        }
        return { destination: 'PHONE_AUTH', cleared: true };
      } else {
        // Network failure or backend temporarily unreachable -> present retry without clearing credentials
        const errorMsg = 'Unable to connect to PondFish. Please check your connection and try again.';
        if (isMountedRef?.current && typeof setError === 'function') {
          setError(errorMsg);
        }
        if (isCheckingRef) {
          isCheckingRef.current = false;
        }
        return { error: errorMsg, isNetwork: true };
      }
    }
  } catch (e) {
    console.error('[SPLASH ERROR]', e);
    const errorMsg = 'We couldn’t start PondFish.';
    if (isMountedRef?.current && typeof setError === 'function') {
      setError(errorMsg);
    }
    if (isCheckingRef) {
      isCheckingRef.current = false;
    }
    return { error: errorMsg, exception: e };
  }
}

module.exports = {
  orchestrateStartupSession,
};

