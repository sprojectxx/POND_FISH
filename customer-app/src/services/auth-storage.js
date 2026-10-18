/**
 * Hardware-Backed Secure Credential Persistence (Android Keystore)
 * Traceability: Final Reconciliation Lock (Issue 1) & Customer Mobile App Specification
 * Uses 'react-native-keychain' backed by Android Keystore. Zero AsyncStorage for secrets.
 */

import * as Keychain from 'react-native-keychain';

const AUTH_SERVICE_KEY = 'com.pondfish.customer.auth';

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
    await Keychain.setGenericPassword('authToken', JSON.stringify({ token, refreshToken }), {
      service: AUTH_SERVICE_KEY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      storage: Keychain.STORAGE_TYPE.KEYSTORE,
    });
    return true;
  });
}

/**
 * Retrieve securely stored authentication credentials.
 * Awaits any in-flight mutation queue to observe consistent state.
 * @returns {Promise<{ token: string, refreshToken: string } | null>}
 */
export async function getAuthTokens() {
  return storageMutationQueue.then(() => readCredentialsDirect());
}

/**
 * Erase credentials upon logout, serialized through storageMutationQueue.
 * If expectedToken is provided, verifies that stored token still matches expectedToken
 * before resetting Keystore. Returns true if cleared, false if obsolete/aborted.
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

    await Keychain.resetGenericPassword({
      service: AUTH_SERVICE_KEY,
    });
    return true;
  });
}
