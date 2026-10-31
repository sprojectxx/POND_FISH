/**
 * PondFish Mobile API Client
 * Traceability: PondFish API Specification v1 (Sections 7, 10, 11)
 * Native fetch client connecting React Native to the Next.js backend.
 */

import { getAuthTokens, saveDeviceToken } from './auth-storage';

// Production API URL for PondFish ecosystem. In development (__DEV__), fallback to localhost loopback for ADB reverse.
const API_BASE_URL = __DEV__
  ? (process.env.API_BASE_URL || 'http://127.0.0.1:3000')
  : 'https://pondfish.in';

// Documented default timeout for standard mobile API requests (15 seconds)
export const DEFAULT_TIMEOUT_MS = 15000;

// Global handler for authenticated session expiration (HTTP 401)
let onUnauthorizedCallback = null;
let lastRejectedToken = null;
let lastRejectedTime = 0;

export function setUnauthorizedHandler(callback) {
  onUnauthorizedCallback = callback;
}

/**
 * Standard API request wrapper with bearer token attachment,
 * centralized AbortController timeout, and caller cancellation support.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  // Resolve effective request timeout in milliseconds
  let effectiveTimeoutMs = DEFAULT_TIMEOUT_MS;
  if (options.timeoutMs === 0 || options.timeout === 0 || options.timeoutMs === null || options.timeout === null || options.timeoutMs === false) {
    effectiveTimeoutMs = 0;
  } else if (typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
    effectiveTimeoutMs = options.timeoutMs;
  } else if (typeof options.timeout === 'number' && options.timeout > 0) {
    effectiveTimeoutMs = options.timeout;
  }

  // Pre-flight check: if caller provided an already aborted signal, abort immediately
  if (options.signal?.aborted) {
    const abortErr = new Error(`Request to ${endpoint} was aborted`);
    abortErr.code = 'API_ABORTED';
    abortErr.isAborted = true;
    abortErr.reason = options.signal.reason || 'Operation aborted by caller';
    throw abortErr;
  }

  // Attach secure Android Keystore token if not already provided
  let requestToken = null;
  if (!headers.Authorization) {
    try {
      const tokens = await getAuthTokens();
      if (tokens && tokens.token) {
        requestToken = tokens.token;
        headers.Authorization = `Bearer ${tokens.token}`;
      }
    } catch (e) {
      console.warn('[API CLIENT] Could not read keystore credentials', e);
    }
  } else if (typeof headers.Authorization === 'string') {
    const match = headers.Authorization.match(/^Bearer\s+(.*)$/i);
    requestToken = match ? match[1] : headers.Authorization;
  }

  // Post-auth check: if caller signal was aborted while awaiting keystore credentials
  if (options.signal?.aborted) {
    const abortErr = new Error(`Request to ${endpoint} was aborted`);
    abortErr.code = 'API_ABORTED';
    abortErr.isAborted = true;
    abortErr.reason = options.signal.reason || 'Operation aborted by caller';
    throw abortErr;
  }

  // Setup AbortController combining internal timeout with caller signal
  const hasAbortController = typeof AbortController !== 'undefined';
  const controller = hasAbortController ? new AbortController() : null;
  let timeoutId = null;
  let didTimeout = false;
  let callerAbortListener = null;

  if (controller) {
    if (options.signal) {
      callerAbortListener = () => {
        try {
          controller.abort(options.signal.reason);
        } catch (_) {}
      };
      if (typeof options.signal.addEventListener === 'function') {
        options.signal.addEventListener('abort', callerAbortListener);
      }
    }

    if (effectiveTimeoutMs > 0) {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        try {
          controller.abort();
        } catch (_) {}
      }, effectiveTimeoutMs);
    }
  } else if (effectiveTimeoutMs > 0 || options.signal) {
    console.warn(
      '[API CLIENT] AbortController is unavailable in current runtime. ' +
      'Network socket cancellation is not supported; timeouts and caller cancellations ' +
      'will reject client-side promises but in-flight HTTP requests cannot be cancelled on the wire.'
    );
  }

  // Strip internal timeout/signal options before dispatching to native fetch
  const {
    timeoutMs: _unusedTimeoutMs,
    timeout: _unusedTimeout,
    signal: _unusedCallerSignal,
    headers: _unusedCustomHeaders,
    ...restFetchOptions
  } = options;

  const fetchOptions = {
    ...restFetchOptions,
    headers,
    ...(controller ? { signal: controller.signal } : {}),
  };

  let response;
  let json;

  try {
    if (!controller) {
      // Safe fallback for runtimes without AbortController
      let fallbackTimer = null;
      let fallbackAbortListener = null;

      const cancellationPromise = new Promise((_, reject) => {
        if (effectiveTimeoutMs > 0) {
          fallbackTimer = setTimeout(() => {
            didTimeout = true;
            const timeoutErr = new Error(
              `Request to ${endpoint} timed out after ${effectiveTimeoutMs}ms (client detached; server state unconfirmed)`
            );
            timeoutErr.code = 'API_TIMEOUT';
            timeoutErr.isTimeout = true;
            timeoutErr.networkCancelled = false;
            reject(timeoutErr);
          }, effectiveTimeoutMs);
        }

        if (options.signal) {
          fallbackAbortListener = () => {
            const abortErr = new Error(`Request to ${endpoint} was cancelled by caller (socket not cancelled)`);
            abortErr.code = 'API_ABORTED';
            abortErr.isAborted = true;
            abortErr.networkCancelled = false;
            abortErr.reason = options.signal.reason || 'Operation cancelled by caller';
            reject(abortErr);
          };
          if (typeof options.signal.addEventListener === 'function') {
            options.signal.addEventListener('abort', fallbackAbortListener);
          }
        }
      });

      const fetchAndParse = (async () => {
        const resp = await fetch(url, fetchOptions);
        const parsed = await resp.json().catch(() => ({}));
        return { resp, parsed };
      })();

      try {
        const result = (effectiveTimeoutMs > 0 || options.signal)
          ? await Promise.race([fetchAndParse, cancellationPromise])
          : await fetchAndParse;
        response = result.resp;
        json = result.parsed;
      } finally {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (fallbackAbortListener && options.signal && typeof options.signal.removeEventListener === 'function') {
          options.signal.removeEventListener('abort', fallbackAbortListener);
        }
      }
    } else {
      response = await fetch(url, fetchOptions);

      // Keep timeout and caller abort active while reading response body stream!
      try {
        json = await response.json();
      } catch (parseErr) {
        if (didTimeout || options.signal?.aborted || parseErr.name === 'AbortError') {
          throw parseErr;
        }
        json = {};
      }
    }
  } catch (err) {
    if (didTimeout) {
      const isUnconfirmed = !controller;
      const timeoutMsg = isUnconfirmed
        ? `Request to ${endpoint} timed out after ${effectiveTimeoutMs}ms (client detached; server state unconfirmed)`
        : `Request to ${endpoint} timed out after ${effectiveTimeoutMs}ms`;
      const timeoutErr = new Error(timeoutMsg);
      timeoutErr.code = 'API_TIMEOUT';
      timeoutErr.isTimeout = true;
      timeoutErr.networkCancelled = Boolean(controller);
      throw timeoutErr;
    }

    if (options.signal?.aborted || err.name === 'AbortError' || err.code === 'API_ABORTED') {
      const abortErr = new Error(`Request to ${endpoint} was aborted`);
      abortErr.code = 'API_ABORTED';
      abortErr.isAborted = true;
      abortErr.networkCancelled = Boolean(controller);
      abortErr.reason = options.signal?.reason || err.reason || err.message;
      throw abortErr;
    }

    const netErr = new Error(err.message || 'Network request failed');
    netErr.code = 'API_NETWORK_ERROR';
    netErr.isNetwork = true;
    netErr.cause = err;
    throw netErr;
  } finally {
    // Both timers and abort listeners are cleaned up only AFTER body parsing completes or fails
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (callerAbortListener && options.signal && typeof options.signal.removeEventListener === 'function') {
      options.signal.removeEventListener('abort', callerAbortListener);
      callerAbortListener = null;
    }
  }

  if (!response.ok) {
    const errorMsg = json?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.code = json?.error?.code || 'API_REQUEST_FAILED';
    err.status = response.status;
    err.details = json?.error?.details || [];

    // Trigger unauthorized session expiration only for authenticated requests that return HTTP 401
    // Explicitly exclude initial unauthenticated auth routes (send-otp and verify-otp),
    // and requests explicitly configured to handle 401 directly (e.g. startup session probe)
    const isAuthEndpoint = !endpoint.includes('/auth/send-otp') && !endpoint.includes('/auth/verify-otp');
    const shouldNotifyUnauthorized = isAuthEndpoint && !options.skipUnauthorizedHandler;
    if (response.status === 401 && shouldNotifyUnauthorized) {
      const now = Date.now();
      const isDuplicate = requestToken === lastRejectedToken && (now - lastRejectedTime < 1500);

      if (typeof onUnauthorizedCallback === 'function' && !isDuplicate) {
        lastRejectedToken = requestToken;
        lastRejectedTime = now;
        try {
          const res = onUnauthorizedCallback(requestToken);
          if (res && typeof res.catch === 'function') {
            res.catch((handlerErr) => {
              console.warn('[API CLIENT] Error in unauthorized session handler', handlerErr);
            });
          }
        } catch (handlerErr) {
          console.warn('[API CLIENT] Error in unauthorized session handler', handlerErr);
        }
      }
    }

    throw err;
  }

  return json;
}

export const api = {
  /**
   * Request OTP dispatch to mobile number
   * POST /api/v1/customer/auth/send-otp
   */
  async sendOtp(mobileNumber, options = {}) {
    return request('/api/v1/customer/auth/send-otp', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ mobileNumber }),
    });
  },

  /**
   * Verify Firebase identity token and establish customer session
   * POST /api/v1/customer/auth/verify-otp
   */
  async verifyOtp({ mobileNumber, idToken }, options = {}) {
    return request('/api/v1/customer/auth/verify-otp', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ mobileNumber, idToken }),
    });
  },

  /**
   * Fetch authenticated customer profile
   * GET /api/v1/customer/profile
   */
  async getProfile(token = null, options = {}) {
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    return request('/api/v1/customer/profile', {
      ...options,
      method: 'GET',
      headers,
    });
  },

  /**
   * Update customer profile
   * PUT /api/v1/customer/profile
   */
  async updateProfile({ name, age, area }, token = null, options = {}) {
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    return request('/api/v1/customer/profile', {
      ...options,
      method: 'PUT',
      headers,
      body: JSON.stringify({ name, age, area }),
    });
  },

  /**
   * Fetch active fish categories
   * GET /api/v1/customer/categories
   */
  async getCategories(options = {}) {
    return request('/api/v1/customer/categories', {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Fetch fish catalogue with optional filters
   * GET /api/v1/customer/fish
   * @param {object} filters - { category_id, search, online_bookable, availability, discount }
   * @param {object} [options={}]
   */
  async getFish(filters = {}, options = {}) {
    const params = new URLSearchParams();
    if (filters.category_id) params.set('category_id', filters.category_id);
    if (filters.search && filters.search.trim()) params.set('search', filters.search.trim());
    if (typeof filters.online_bookable === 'boolean') params.set('online_bookable', String(filters.online_bookable));
    if (typeof filters.availability === 'boolean') params.set('availability', String(filters.availability));
    if (typeof filters.discount === 'boolean') params.set('discount', String(filters.discount));

    const qs = params.toString();
    const endpoint = `/api/v1/customer/fish${qs ? `?${qs}` : ''}`;
    return request(endpoint, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Fetch single fish details by ID
   * GET /api/v1/customer/fish/{id}
   */
  async getFishDetails(id, options = {}) {
    return request(`/api/v1/customer/fish/${encodeURIComponent(id)}`, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Fetch customer cart
   * GET /api/v1/customer/cart
   */
  async getCart(options = {}) {
    return request('/api/v1/customer/cart', {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Add fish to customer cart
   * POST /api/v1/customer/cart/items
   */
  async addToCart({ fishId, quantity = 1 }, options = {}) {
    return request('/api/v1/customer/cart/items', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ fish_id: fishId, quantity }),
    });
  },

  /**
   * Update quantity of a fish item in cart
   * PATCH /api/v1/customer/cart/items/{id}
   */
  async updateCartQuantity({ fishId, quantity }, options = {}) {
    return request(`/api/v1/customer/cart/items/${encodeURIComponent(fishId)}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  },

  /**
   * Remove fish item from cart
   * DELETE /api/v1/customer/cart/items/{id}
   */
  async removeFromCart(fishId, options = {}) {
    return request(`/api/v1/customer/cart/items/${encodeURIComponent(fishId)}`, {
      ...options,
      method: 'DELETE',
    });
  },

  /**
   * Clear all items from cart
   * DELETE /api/v1/customer/cart
   */
  async clearCart(options = {}) {
    return request('/api/v1/customer/cart', {
      ...options,
      method: 'DELETE',
    });
  },

  /**
   * Authoritative checkout preview
   * POST /api/v1/customer/bookings/preview
   */
  async getCheckoutPreview(options = {}) {
    return request('/api/v1/customer/bookings/preview', {
      ...options,
      method: 'POST',
    });
  },

  /**
   * Create online booking with atomic inventory reservation
   * POST /api/v1/customer/bookings
   * @param {object} [paymentVerification]
   * @param {object} [options={}]
   */
  async createBooking(paymentVerification = null, options = {}) {
    return request('/api/v1/customer/bookings', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ paymentVerification }),
    });
  },

  /**
   * List customer bookings history
   * GET /api/v1/customer/bookings
   */
  async getBookings({ limit = 50, offset = 0 } = {}, options = {}) {
    return request(`/api/v1/customer/bookings?limit=${limit}&offset=${offset}`, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Get single booking details with QR ticket
   * GET /api/v1/customer/bookings/{id}
   */
  async getBookingDetails(bookingId, options = {}) {
    return request(`/api/v1/customer/bookings/${encodeURIComponent(bookingId)}`, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Cancel an active booking and release reserved stock
   * POST /api/v1/customer/bookings/{id}/cancel
   */
  async cancelBooking(bookingId, options = {}) {
    return request(`/api/v1/customer/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      ...options,
      method: 'POST',
    });
  },

  /**
   * Trigger authoritative booking expiry processing
   * POST /api/v1/customer/bookings/expire
   */
  async processBookingExpiry(bookingId = null, options = {}) {
    return request('/api/v1/customer/bookings/expire', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ bookingId }),
    });
  },

  /**
   * Create Razorpay order intent for checkout
   * POST /api/v1/payments/razorpay/orders
   */
  async createRazorpayOrder(payload = {}, options = {}) {
    return request('/api/v1/payments/razorpay/orders', {
      ...options,
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch authenticated customer's active subscription status
   * GET /api/v1/customer/subscription
   */
  async getSubscription(options = {}) {
    return request('/api/v1/customer/subscription', {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Fetch available active subscription plans
   * GET /api/v1/customer/subscription/plans
   */
  async getSubscriptionPlans(options = {}) {
    return request('/api/v1/customer/subscription/plans', {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Initiate subscription purchase intent (Razorpay order creation)
   * POST /api/v1/customer/subscription/purchase
   * @param {string} planId
   */
  async purchaseSubscription(planId, options = {}) {
    return request('/api/v1/customer/subscription/purchase', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  },

  /**
   * Verify Razorpay payment signature and activate subscription
   * POST /api/v1/customer/subscription/verify
   * @param {object} params
   */
  async verifySubscriptionPayment({ planId, razorpayOrderId, razorpayPaymentId, razorpaySignature }, options = {}) {
    return request('/api/v1/customer/subscription/verify', {
      ...options,
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
  async getSubscriptionLedger({ limit = 50, offset = 0 } = {}, options = {}) {
    return request(`/api/v1/customer/subscription/ledger?limit=${limit}&offset=${offset}`, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Retrieve customer notifications list with pagination and optional category filter
   * GET /api/v1/customer/notifications
   * @param {object} [params]
   */
  async getNotifications({ limit = 50, offset = 0, type = null } = {}, options = {}) {
    const query = new URLSearchParams({ limit, offset });
    if (type && type.toUpperCase() !== 'ALL') {
      query.set('type', type.toUpperCase());
    }
    return request(`/api/v1/customer/notifications?${query.toString()}`, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Mark a single notification as read
   * PATCH /api/v1/customer/notifications/[id]/read
   * @param {string} notificationId
   */
  async markNotificationRead(notificationId, options = {}) {
    return request(`/api/v1/customer/notifications/${notificationId}/read`, {
      ...options,
      method: 'PATCH',
    });
  },

  /**
   * Mark all unread customer notifications as read
   * POST /api/v1/customer/notifications/mark-all-read
   */
  async markAllNotificationsRead(options = {}) {
    return request('/api/v1/customer/notifications/mark-all-read', {
      ...options,
      method: 'POST',
    });
  },

  /**
   * Register customer FCM device token
   * POST /api/v1/customer/notifications/device
   * @param {string} deviceToken
   * @param {string} [platform='android']
   * @param {object} [options={}]
   */
  async registerDeviceToken(deviceToken, platform = 'android', options = {}) {
    const res = await request('/api/v1/customer/notifications/device', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ deviceToken, platform }),
    });
    if (res?.success) {
      await saveDeviceToken(deviceToken).catch(() => {});
    }
    return res;
  },

  /**
   * Unregister customer FCM device token on logout
   * DELETE /api/v1/customer/notifications/device
   * @param {string} deviceToken
   * @param {object} [options={}]
   */
  async unregisterDeviceToken(deviceToken, options = {}) {
    const res = await request('/api/v1/customer/notifications/device', {
      ...options,
      method: 'DELETE',
      body: JSON.stringify({ deviceToken }),
    });
    await clearDeviceToken().catch(() => {});
    return res;
  },

  /**
   * Scan physical store bill via camera/image upload
   * POST /api/v1/customer/bills/scan
   * @param {object} params - { imageBase64, imageUrl, formData }
   * @param {object} [options={}]
   */
  async scanBill({ imageBase64, imageUrl, formData, dryRun = false } = {}, options = {}) {
    const query = dryRun ? '?dry_run=true' : '';
    const headers = {
      ...(dryRun ? { 'x-scan-dry-run': 'true' } : {}),
      ...(options.headers || {}),
    };
    if (formData) {
      if (dryRun) {
        formData.append('dry_run', 'true');
      }
      return request(`/api/v1/customer/bills/scan${query}`, {
        ...options,
        method: 'POST',
        headers,
        body: formData,
      });
    }
    return request(`/api/v1/customer/bills/scan${query}`, {
      ...options,
      method: 'POST',
      headers,
      body: JSON.stringify({
        image_base64: imageBase64,
        image_url: imageUrl,
        dry_run: dryRun,
      }),
    });
  },

  /**
   * Retrieve extracted bill details by scan ID
   * GET /api/v1/customer/bills/scans/{id}
   * @param {string} scanId
   * @param {object} [options={}]
   */
  async getBillScan(scanId, options = {}) {
    return request(`/api/v1/customer/bills/scans/${scanId}`, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Set manual Bill Number when AI OCR missed or cannot read it
   * POST /api/v1/customer/bills/scans/{id}/bill-number
   * @param {string} scanId
   * @param {string} billNumber
   * @param {object} [options={}]
   */
  async updateBillNumber(scanId, billNumber, options = {}) {
    return request(`/api/v1/customer/bills/scans/${scanId}/bill-number`, {
      ...options,
      method: 'POST',
      body: JSON.stringify({ bill_number: billNumber }),
    });
  },

  /**
   * Authoritative preview of subscription coverage and final payable amount
   * POST /api/v1/customer/bills/scans/{id}/preview
   * @param {string} scanId
   * @param {Array<object>} [items]
   * @param {object} [options={}]
   */
  async previewPhysicalTransaction(scanId, items = [], options = {}) {
    return request(`/api/v1/customer/bills/scans/${scanId}/preview`, {
      ...options,
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  /**
   * Confirm bill before payment
   * POST /api/v1/customer/bills/scans/{id}/confirm
   * @param {string} scanId
   * @param {object} [options={}]
   */
  async confirmBillScan(scanId, options = {}) {
    return request(`/api/v1/customer/bills/scans/${scanId}/confirm`, {
      ...options,
      method: 'POST',
    });
  },

  /**
   * Commit physical store purchase transaction
   * POST /api/v1/customer/transactions/commit
   * @param {object} params
   * @param {object} [options={}]
   */
  async commitPhysicalTransaction({
    scanId,
    billId,
    paymentMethod = 'RAZORPAY',
    razorpayPaymentId = null,
    razorpayOrderId = null,
    razorpaySignature = null,
    items = [],
  }, options = {}) {
    return request('/api/v1/customer/transactions/commit', {
      ...options,
      method: 'POST',
      body: JSON.stringify({
        scan_id: scanId || billId,
        bill_id: billId || scanId,
        payment_method: paymentMethod,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        razorpay_signature: razorpaySignature,
        items,
      }),
    });
  },

  /**
   * Retrieve customer physical purchase and booking transactions
   * GET /api/v1/customer/transactions
   * @param {object} [params]
   * @param {object} [options={}]
   */
  async getCustomerTransactions({ limit = 50, offset = 0 } = {}, options = {}) {
    return request(`/api/v1/customer/transactions?limit=${limit}&offset=${offset}`, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Retrieve a specific transaction receipt by ID
   * GET /api/v1/customer/transactions/{id}
   * @param {string} transactionId
   * @param {object} [options={}]
   */
  async getTransactionDetails(transactionId, options = {}) {
    return request(`/api/v1/customer/transactions/${encodeURIComponent(transactionId)}`, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Retrieve active live GPS delivery tracking for customer
   * GET /api/v1/customer/gps/live
   * @param {object} [options={}]
   */
  async getCustomerLiveTracking(options = {}) {
    return request('/api/v1/customer/gps/live', {
      ...options,
      method: 'GET',
    });
  },

  /**
   * Retrieve a specific customer-published GPS journey by ID
   * GET /api/v1/customer/gps/journeys/{id}
   * @param {string} journeyId
   * @param {object} [options={}]
   */
  async getCustomerJourneyById(journeyId, options = {}) {
    return request(`/api/v1/customer/gps/journeys/${journeyId}`, {
      ...options,
      method: 'GET',
    });
  },
};



