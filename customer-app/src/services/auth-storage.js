/**
 * Hardware-Backed Secure Credential Persistence (Android Keystore)
 * Traceability: Final Reconciliation Lock (Issue 1) & Customer Mobile App Specification
 * Uses 'react-native-keychain' backed by Android Keystore. Zero AsyncStorage for secrets.
 */

import * as Keychain from 'react-native-keychain';

const AUTH_SERVICE_KEY = 'com.pondfish.customer.auth';
const DEVICE_TOKEN_SERVICE_KEY = 'com.pondfish.customer.device_token';
const LOGOUT_PENDING_SERVICE_KEY = 'com.pondfish.customer.logout_pending';

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
    try {
      await Keychain.resetGenericPassword({
        service: LOGOUT_PENDING_SERVICE_KEY,
      });
    } catch (_) {}
    await Keychain.setGenericPassword('authToken', JSON.stringify({ token, refreshToken }), {
      service: AUTH_SERVICE_KEY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      storage: Keychain.STORAGE_TYPE.KEYSTORE,
    });
    return true;
  });
}

// Internal direct checker for pending logout tombstone
async function isLogoutPendingInternal() {
  try {
    const creds = await Keychain.getGenericPassword({
      service: LOGOUT_PENDING_SERVICE_KEY,
    });
    return Boolean(creds && creds.password === '1');
  } catch (_) {
    return false;
  }
}

/**
 * Checks whether an uncompleted or interrupted logout tombstone exists in Keystore.
 * @returns {Promise<boolean>}
 */
export async function isLogoutPending() {
  return isLogoutPendingInternal();
}

/**
 * Retrieve securely stored authentication credentials.
 * Awaits any in-flight mutation queue to observe consistent state.
 * @returns {Promise<{ token: string, refreshToken: string } | null>}
 */
export async function getAuthTokens() {
  return storageMutationQueue.then(async () => {
    const pending = await isLogoutPendingInternal();
    if (pending) {
      // Incomplete or interrupted logout detected; do not restore credentials
      return null;
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

    // Mark persistent logout pending tombstone before executing primary reset
    try {
      await Keychain.setGenericPassword('logoutPending', '1', {
        service: LOGOUT_PENDING_SERVICE_KEY,
      });
    } catch (_) {}

    // Primary credential reset: hardware exceptions propagate to caller
    await Keychain.resetGenericPassword({
      service: AUTH_SERVICE_KEY,
    });

    // Verification check: ensure primary authentication credential is genuinely absent
    const verifyCreds = await readCredentialsDirect();
    if (verifyCreds && verifyCreds.token) {
      throw new Error('Primary authentication credential could not be cleared from Keystore');
    }

    // Primary credential is confirmed absent; clear persistent logout pending tombstone
    try {
      await Keychain.resetGenericPassword({
        service: LOGOUT_PENDING_SERVICE_KEY,
      });
    } catch (_) {}

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
