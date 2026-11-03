/**
 * Hardware-Backed Secure Credential Persistence (Android Keystore)
 * Traceability: Final Reconciliation Lock (Issue 1) & Customer Mobile App Specification
 * Uses 'react-native-keychain' backed by Android Keystore. Zero AsyncStorage for secrets.
 */

import * as Keychain from 'react-native-keychain';

const AUTH_SERVICE_KEY = 'com.pondfish.customer.auth';
const DEVICE_TOKEN_SERVICE_KEY = 'com.pondfish.customer.device_token';
const LOGOUT_PENDING_SERVICE_KEY = 'com.pondfish.customer.logout_pending';

const TOMBSTONE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  UNKNOWN: 'UNKNOWN',
};

let cachedDeviceToken = null;

// Internal direct reader without queue dependency to avoid circular deadlocks
async function readCredentialsDirect() {
  const credentials = await Keychain.getGenericPassword({
    service: AUTH_SERVICE_KEY,
  });

  if (credentials && credentials.password) {
    try {
      return JSON.parse(credentials.password);
    } catch {
      return { token: credentials.password, refreshToken: '' };
    }
  }

  return null;
}

// Promise queue serializing all asynchronous storage mutations (save and clear)
let storageMutationQueue = Promise.resolve();

function enqueueStorageMutation(operation) {
  const next = storageMutationQueue.then(operation, operation);
  storageMutationQueue = next.catch(() => {});
  return next;
}

/**
 * Save authentication token and optional refresh token securely to Android Keystore.
 * Serialized through storageMutationQueue.
 * @param {string} token - Primary JWT or session token
 * @param {string} [refreshToken] - Optional refresh token
 */
export async function saveAuthTokens(token, refreshToken = '') {
  if (!token) throw new Error('Token is required for secure persistence');

  return enqueueStorageMutation(async () => {
    // Clear any prior logout pending marker before saving new credentials
    try {
      const resetMarkerRes = await Keychain.resetGenericPassword({
        service: LOGOUT_PENDING_SERVICE_KEY,
      });
      if (resetMarkerRes === false) {
        throw new Error('Failed to reset logout pending marker from Keystore (returned false)');
      }
    } catch (markerErr) {
      console.warn('[AUTH STORAGE] Could not clear existing logout pending marker before saving', markerErr);
      throw markerErr;
    }

    // Verify old tombstone is confirmed absent before saving new credentials
    const tombstoneCheck = await getLogoutPendingStatusInternal();
    if (tombstoneCheck.status !== TOMBSTONE_STATUS.ABSENT) {
      throw new Error(`Cannot save credentials: old tombstone is not confirmed absent (status: ${tombstoneCheck.status})`);
    }

    const setRes = await Keychain.setGenericPassword('authToken', JSON.stringify({ token, refreshToken }), {
      service: AUTH_SERVICE_KEY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      storage: Keychain.STORAGE_TYPE.KEYSTORE,
    });
    if (setRes === false) {
      throw new Error('Failed to persist authentication credentials to Keystore (returned false)');
    }

    // Read-back verification of newly persisted credentials
    let readBackCreds;
    try {
      readBackCreds = await Keychain.getGenericPassword({
        service: AUTH_SERVICE_KEY,
      });
    } catch (readErr) {
      const sanitizedErr = new Error('Credential verification failed: error reading back from Keystore');
      sanitizedErr.cause = readErr;
      throw sanitizedErr;
    }

    if (!readBackCreds || readBackCreds === false || !readBackCreds.password) {
      throw new Error('Credential verification failed: credentials missing');
    }

    let parsed;
    try {
      parsed = JSON.parse(readBackCreds.password);
    } catch (parseErr) {
      throw new Error('Credential verification failed: stored credentials malformed');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Credential verification failed: stored credentials malformed');
    }

    if (parsed.token !== token) {
      throw new Error('Credential verification failed: token mismatch');
    }

    const expectedRefresh = refreshToken || '';
    const actualRefresh = parsed.refreshToken || '';
    if (actualRefresh !== expectedRefresh) {
      throw new Error('Credential verification failed: refresh token mismatch');
    }

    return true;
  });
}

// Internal direct tri-state checker for pending logout tombstone
async function getLogoutPendingStatusInternal() {
  try {
    const creds = await Keychain.getGenericPassword({
      service: LOGOUT_PENDING_SERVICE_KEY,
    });
    if (!creds || creds === false) {
      return { status: TOMBSTONE_STATUS.ABSENT, present: false };
    }
    if (creds && typeof creds === 'object' && creds.password === '1') {
      return { status: TOMBSTONE_STATUS.PRESENT, present: true };
    }
    // Unexpected or malformed marker value -> treat as unsafe/unknown state. Never interpret as confirmed absence.
    return {
      status: TOMBSTONE_STATUS.UNKNOWN,
      present: null,
      error: new Error('Unexpected or malformed tombstone marker in Keystore'),
    };
  } catch (err) {
    return { status: TOMBSTONE_STATUS.UNKNOWN, present: null, error: err };
  }
}

/**
 * Checks the persistent logout pending marker with explicit tri-state status:
 * - PRESENT: Marker confirmed present in secure storage
 * - ABSENT: Marker confirmed absent from secure storage
 * - UNKNOWN: Secure storage failed; state cannot be determined safely
 * @returns {Promise<{ status: string, present: boolean | null, error?: Error }>}
 */
export async function getLogoutPendingStatus() {
  return getLogoutPendingStatusInternal();
}

/**
 * Checks whether an uncompleted or interrupted logout tombstone exists in Keystore.
 * Fails closed: throws TOMBSTONE_STORAGE_ERROR if secure storage fails, never returns false.
 * @returns {Promise<boolean>}
 */
export async function isLogoutPending() {
  const result = await getLogoutPendingStatusInternal();
  if (result.status === TOMBSTONE_STATUS.UNKNOWN) {
    const err = new Error('Secure storage failed while reading logout tombstone marker');
    err.code = 'TOMBSTONE_STORAGE_ERROR';
    err.cause = result.error;
    throw err;
  }
  return result.present;
}

/**
 * Retrieve securely stored authentication credentials.
 * Awaits any in-flight mutation queue to observe consistent state.
 * Fails closed: if logout tombstone cannot be safely determined, throws TOMBSTONE_STORAGE_ERROR
 * and does not return previously stored credentials.
 * @returns {Promise<{ token: string, refreshToken: string } | null>}
 */
export async function getAuthTokens() {
  return storageMutationQueue.then(async () => {
    const tombstone = await getLogoutPendingStatusInternal();
    if (tombstone.status === TOMBSTONE_STATUS.PRESENT) {
      // Incomplete or interrupted logout detected; do not restore credentials
      return null;
    }
    if (tombstone.status === TOMBSTONE_STATUS.UNKNOWN) {
      // Secure storage cannot establish whether an interrupted logout exists.
      // Must not return previously stored credentials when logout state cannot be safely determined.
      const err = new Error('Cannot determine logout state: secure storage failed while reading tombstone');
      err.code = 'TOMBSTONE_STORAGE_ERROR';
      err.cause = tombstone.error;
      throw err;
    }
    return readCredentialsDirect();
  });
}

/**
 * Erase credentials upon logout, serialized through storageMutationQueue.
 * If expectedToken is provided, verifies that stored token still matches expectedToken
 * before resetting Keystore. Returns true if cleared, false if obsolete/aborted.
 * Ensures Keystore exceptions propagate to caller, and verifies credentials are absent.
 * @param {string|null} [expectedToken] - Optional token to verify before clearing
 */
export async function clearAuthTokens(expectedToken = null) {
  return enqueueStorageMutation(async () => {
    if (expectedToken) {
      const current = await readCredentialsDirect();
      if (!current?.token || current.token !== expectedToken) {
        console.warn('[AUTH STORAGE] Aborting token clear: stored token does not match rejected token');
        return false;
      }
    }

    // Step 1: Write persistent logout pending marker before executing primary reset.
    // Must NOT silently ignore failure: if writing marker fails or returns false, do not proceed.
    const markerWriteRes = await Keychain.setGenericPassword('logoutPending', '1', {
      service: LOGOUT_PENDING_SERVICE_KEY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      storage: Keychain.STORAGE_TYPE.KEYSTORE,
    });
    if (markerWriteRes === false) {
      throw new Error('Failed to write logout pending tombstone to Keystore (returned false)');
    }

    // Verify tombstone is confirmed present before resetting primary credentials
    const tombstoneStatus = await getLogoutPendingStatusInternal();
    if (tombstoneStatus.status !== TOMBSTONE_STATUS.PRESENT) {
      throw new Error(`Logout tombstone not confirmed present before primary reset (status: ${tombstoneStatus.status})`);
    }

    // Step 2: Primary credential reset: verify return value and propagate hardware exceptions
    const resetCredsRes = await Keychain.resetGenericPassword({
      service: AUTH_SERVICE_KEY,
    });
    if (resetCredsRes === false) {
      throw new Error('Failed to reset primary authentication credentials in Keystore (returned false)');
    }

    // Step 3: Verification check: ensure primary authentication credential is genuinely absent
    const verifyCreds = await Keychain.getGenericPassword({
      service: AUTH_SERVICE_KEY,
    });
    if (verifyCreds && (verifyCreds.password || verifyCreds.username)) {
      throw new Error('Primary authentication credential could not be cleared from Keystore');
    }

    // Step 4: Primary credential confirmed absent; clear persistent logout pending tombstone.
    // Must NOT silently ignore failure: verify marker cleanup succeeded and returned true.
    const resetMarkerRes = await Keychain.resetGenericPassword({
      service: LOGOUT_PENDING_SERVICE_KEY,
    });
    if (resetMarkerRes === false) {
      throw new Error('Failed to clear logout tombstone marker from Keystore (returned false)');
    }

    // Step 5: Verify tombstone deletion by reading the marker back
    const verifyMarkerStatus = await getLogoutPendingStatusInternal();
    if (verifyMarkerStatus.status !== TOMBSTONE_STATUS.ABSENT) {
      throw new Error(`Logout tombstone marker could not be confirmed absent from Keystore (status: ${verifyMarkerStatus.status})`);
    }

    // Device-token cleanup failure is handled and reported separately without failing primary logout
    try {
      cachedDeviceToken = null;
      await Keychain.resetGenericPassword({
        service: DEVICE_TOKEN_SERVICE_KEY,
      });
    } catch (deviceErr) {
      console.warn('[AUTH STORAGE] Device-token cleanup encountered error, but primary auth token was cleared');
    }

    return true;
  });
}

/**
 * Persist FCM device registration token securely to Android Keystore.
 * @param {string} deviceToken - Unique FCM registration token
 * @returns {Promise<boolean>}
 */
export async function saveDeviceToken(deviceToken) {
  if (!deviceToken || typeof deviceToken !== 'string' || !deviceToken.trim()) {
    return false;
  }
  const trimmed = deviceToken.trim();
  cachedDeviceToken = trimmed;
  return enqueueStorageMutation(async () => {
    try {
      await Keychain.setGenericPassword('deviceToken', trimmed, {
        service: DEVICE_TOKEN_SERVICE_KEY,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
        storage: Keychain.STORAGE_TYPE.KEYSTORE,
      });
      return true;
    } catch (err) {
      console.warn('[AUTH STORAGE] Could not persist device token to Keystore', err);
      return false;
    }
  });
}

/**
 * Retrieve securely stored FCM device registration token.
 * @returns {Promise<string|null>}
 */
export async function getDeviceToken() {
  if (cachedDeviceToken) {
    return cachedDeviceToken;
  }
  return storageMutationQueue.then(async () => {
    try {
      const creds = await Keychain.getGenericPassword({
        service: DEVICE_TOKEN_SERVICE_KEY,
      });
      if (creds && creds.password) {
        cachedDeviceToken = creds.password;
        return creds.password;
      }
    } catch (err) {
      console.warn('[AUTH STORAGE] Could not read device token from Keystore', err);
    }
    return null;
  });
}

/**
 * Erase stored FCM device registration token from Android Keystore.
 * @returns {Promise<boolean>}
 */
export async function clearDeviceToken() {
  cachedDeviceToken = null;
  return enqueueStorageMutation(async () => {
    try {
      await Keychain.resetGenericPassword({
        service: DEVICE_TOKEN_SERVICE_KEY,
      });
      return true;
    } catch (err) {
      console.warn('[AUTH STORAGE] Could not reset device token in Keystore', err);
      return false;
    }
  });
}
