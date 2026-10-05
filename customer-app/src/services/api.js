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
   * Verify Firebase identity token and establish customer session
   * POST /api/v1/customer/auth/verify-otp
   */
  async verifyOtp({ mobileNumber, idToken }) {
    return request('/api/v1/customer/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, idToken }),
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

  /**
   * Fetch active fish categories
   * GET /api/v1/customer/categories
   */
  async getCategories() {
    return request('/api/v1/customer/categories', {
      method: 'GET',
    });
  },

  /**
   * Fetch fish catalogue with optional filters
   * GET /api/v1/customer/fish
   * @param {object} filters - { category_id, search, online_bookable, availability, discount }
   */
  async getFish(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category_id) params.set('category_id', filters.category_id);
    if (filters.search && filters.search.trim()) params.set('search', filters.search.trim());
    if (typeof filters.online_bookable === 'boolean') params.set('online_bookable', String(filters.online_bookable));
    if (typeof filters.availability === 'boolean') params.set('availability', String(filters.availability));
    if (typeof filters.discount === 'boolean') params.set('discount', String(filters.discount));

    const qs = params.toString();
    const endpoint = `/api/v1/customer/fish${qs ? `?${qs}` : ''}`;
    return request(endpoint, {
      method: 'GET',
    });
  },

  /**
   * Fetch single fish details by ID
   * GET /api/v1/customer/fish/{id}
   */
  async getFishDetails(id) {
    return request(`/api/v1/customer/fish/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  },

  /**
   * Fetch customer cart
   * GET /api/v1/customer/cart
   */
  async getCart() {
    return request('/api/v1/customer/cart', {
      method: 'GET',
    });
  },

  /**
   * Add fish to customer cart
   * POST /api/v1/customer/cart/items
   */
  async addToCart({ fishId, quantity = 1 }) {
    return request('/api/v1/customer/cart/items', {
      method: 'POST',
      body: JSON.stringify({ fish_id: fishId, quantity }),
    });
  },

  /**
   * Update quantity of a fish item in cart
   * PATCH /api/v1/customer/cart/items/{id}
   */
  async updateCartQuantity({ fishId, quantity }) {
    return request(`/api/v1/customer/cart/items/${encodeURIComponent(fishId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  },

  /**
   * Remove fish item from cart
   * DELETE /api/v1/customer/cart/items/{id}
   */
  async removeFromCart(fishId) {
    return request(`/api/v1/customer/cart/items/${encodeURIComponent(fishId)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Clear all items from cart
   * DELETE /api/v1/customer/cart
   */
  async clearCart() {
    return request('/api/v1/customer/cart', {
      method: 'DELETE',
    });
  },

  /**
   * Authoritative checkout preview
   * POST /api/v1/customer/bookings/preview
   */
  async getCheckoutPreview() {
    return request('/api/v1/customer/bookings/preview', {
      method: 'POST',
    });
  },

  /**
   * Create online booking with atomic inventory reservation
   * POST /api/v1/customer/bookings
   * @param {object} [paymentVerification]
   */
  async createBooking(paymentVerification = null) {
    return request('/api/v1/customer/bookings', {
      method: 'POST',
      body: JSON.stringify({ paymentVerification }),
    });
  },

  /**
   * List customer bookings history
   * GET /api/v1/customer/bookings
   */
  async getBookings({ limit = 50, offset = 0 } = {}) {
    return request(`/api/v1/customer/bookings?limit=${limit}&offset=${offset}`, {
      method: 'GET',
    });
  },

  /**
   * Get single booking details with QR ticket
   * GET /api/v1/customer/bookings/{id}
   */
  async getBookingDetails(bookingId) {
    return request(`/api/v1/customer/bookings/${encodeURIComponent(bookingId)}`, {
      method: 'GET',
    });
  },

  /**
   * Cancel an active booking and release reserved stock
   * POST /api/v1/customer/bookings/{id}/cancel
   */
  async cancelBooking(bookingId) {
    return request(`/api/v1/customer/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
    });
  },

  /**
   * Trigger authoritative booking expiry processing
   * POST /api/v1/customer/bookings/expire
   */
  async processBookingExpiry(bookingId = null) {
    return request('/api/v1/customer/bookings/expire', {
      method: 'POST',
      body: JSON.stringify({ bookingId }),
    });
  },

  /**
   * Create Razorpay order intent for checkout
   * POST /api/v1/payments/razorpay/orders
   */
  async createRazorpayOrder() {
    return request('/api/v1/payments/razorpay/orders', {
      method: 'POST',
    });
  },

  /**
   * Fetch authenticated customer's active subscription status
   * GET /api/v1/customer/subscription
   */
  async getSubscription() {
    return request('/api/v1/customer/subscription', {
      method: 'GET',
    });
  },

  /**
   * Fetch available active subscription plans
   * GET /api/v1/customer/subscription/plans
   */
  async getSubscriptionPlans() {
    return request('/api/v1/customer/subscription/plans', {
      method: 'GET',
    });
  },

  /**
   * Initiate subscription purchase intent (Razorpay order creation)
   * POST /api/v1/customer/subscription/purchase
   * @param {string} planId
   */
  async purchaseSubscription(planId) {
    return request('/api/v1/customer/subscription/purchase', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  },

  /**
   * Verify Razorpay payment signature and activate subscription
   * POST /api/v1/customer/subscription/verify
   * @param {object} params
   */
  async verifySubscriptionPayment({ planId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    return request('/api/v1/customer/subscription/verify', {
      method: 'POST',
      body: JSON.stringify({
        planId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      }),
    });
  },

  /**
   * Retrieve customer subscription credit movements ledger
   * GET /api/v1/customer/subscription/ledger
   * @param {object} [params]
   */
  async getSubscriptionLedger({ limit = 50, offset = 0 } = {}) {
    return request(`/api/v1/customer/subscription/ledger?limit=${limit}&offset=${offset}`, {
      method: 'GET',
    });
  },

  /**
   * Retrieve customer notifications list with pagination and optional category filter
   * GET /api/v1/customer/notifications
   * @param {object} [params]
   */
  async getNotifications({ limit = 50, offset = 0, type = null } = {}) {
    const query = new URLSearchParams({ limit, offset });
    if (type && type.toUpperCase() !== 'ALL') {
      query.set('type', type.toUpperCase());
    }
    return request(`/api/v1/customer/notifications?${query.toString()}`, {
      method: 'GET',
    });
  },

  /**
   * Mark a single notification as read
   * PATCH /api/v1/customer/notifications/[id]/read
   * @param {string} notificationId
   */
  async markNotificationRead(notificationId) {
    return request(`/api/v1/customer/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  },

  /**
   * Mark all unread customer notifications as read
   * POST /api/v1/customer/notifications/mark-all-read
   */
  async markAllNotificationsRead() {
    return request('/api/v1/customer/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  /**
   * Register customer FCM device token
   * POST /api/v1/customer/notifications/device
   * @param {string} deviceToken
   * @param {string} [platform='android']
   */
  async registerDeviceToken(deviceToken, platform = 'android') {
    return request('/api/v1/customer/notifications/device', {
      method: 'POST',
      body: JSON.stringify({ deviceToken, platform }),
    });
  },

  /**
   * Unregister customer FCM device token on logout
   * DELETE /api/v1/customer/notifications/device
   * @param {string} deviceToken
   */
  async unregisterDeviceToken(deviceToken) {
    return request('/api/v1/customer/notifications/device', {
      method: 'DELETE',
      body: JSON.stringify({ deviceToken }),
    });
  },
};


