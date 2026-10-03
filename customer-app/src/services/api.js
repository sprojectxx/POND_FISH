/**
 * PondFish Mobile API Client
 * Traceability: PondFish API Specification v1 (Sections 7, 10, 11)
 * Native fetch client connecting React Native to the Next.js backend.
 */

import { getAuthTokens } from './auth-storage';

// In Android emulator 10.0.2.2 points to host localhost; fallback to localhost for development
const API_BASE_URL = process.env.API_BASE_URL || 'http://10.0.2.2:3000';

/**
 * Standard API request wrapper with bearer token attachment
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach secure Android Keystore token if not already provided
  if (!headers.Authorization) {
    try {
      const tokens = await getAuthTokens();
      if (tokens && tokens.token) {
        headers.Authorization = `Bearer ${tokens.token}`;
      }
    } catch (e) {
      console.warn('[API CLIENT] Could not read keystore credentials', e);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = json?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.code = json?.error?.code || 'API_REQUEST_FAILED';
    err.status = response.status;
    err.details = json?.error?.details || [];
    throw err;
  }

  return json;
}

export const api = {
  /**
   * Request OTP dispatch to mobile number
   * POST /api/v1/customer/auth/send-otp
   */
  async sendOtp(mobileNumber) {
    return request('/api/v1/customer/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber }),
    });
  },

  /**
   * Verify Phone OTP / Firebase identity and establish customer session
   * POST /api/v1/customer/auth/verify-otp
   */
  async verifyOtp({ mobileNumber, idToken, otp }) {
    return request('/api/v1/customer/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, idToken, otp }),
    });
  },

  /**
   * Fetch authenticated customer profile
   * GET /api/v1/customer/profile
   */
  async getProfile(token = null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return request('/api/v1/customer/profile', {
      method: 'GET',
      headers,
    });
  },

  /**
   * Update customer profile
   * PATCH /api/v1/customer/profile
   */
  async updateProfile({ name, age, area }, token = null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return request('/api/v1/customer/profile', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name, age, area }),
    });
  },
};
