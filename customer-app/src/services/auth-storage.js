/**
 * Hardware-Backed Secure Credential Persistence (Android Keystore)
 * Traceability: Final Reconciliation Lock (Issue 1) & Customer Mobile App Specification
 * Uses 'react-native-keychain' backed by Android Keystore. Zero AsyncStorage for secrets.
 */

import * as Keychain from 'react-native-keychain';

const AUTH_SERVICE_KEY = 'com.pondfish.customer.auth';

/**
 * Save authentication token and optional refresh token securely to Android Keystore
 * @param {string} token - Primary JWT or session token
 * @param {string} [refreshToken] - Optional refresh token
 */
export async function saveAuthTokens(token, refreshToken = '') {
  if (!token) throw new Error('Token is required for secure persistence');

  await Keychain.setGenericPassword('authToken', JSON.stringify({ token, refreshToken }), {
    service: AUTH_SERVICE_KEY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
    storage: Keychain.STORAGE_TYPE.KEYSTORE,
  });
}

/**
 * Retrieve securely stored authentication credentials
 * @returns {Promise<{ token: string, refreshToken: string } | null>}
 */
export async function getAuthTokens() {
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

/**
 * Erase credentials upon logout
 */
export async function clearAuthTokens() {
  await Keychain.resetGenericPassword({
    service: AUTH_SERVICE_KEY,
  });
}
