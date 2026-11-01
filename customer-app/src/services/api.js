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
 * Supported fetch options affecting HTTP request/response semantics.
 */
const SUPPORTED_SEMANTIC_FETCH_OPTIONS = [
  'cache',
  'credentials',
  'integrity',
  'keepalive',
  'mode',
  'priority',
  'redirect',
  'referrer',
  'referrerPolicy',
];

const KNOWN_REQUEST_OPTIONS = new Set([
  'method',
  'headers',
  'timeoutMs',
  'timeout',
  'signal',
  'bypassDedup',
  'bypassCache',
  'skipUnauthorizedHandler',
  ...SUPPORTED_SEMANTIC_FETCH_OPTIONS,
]);

/**
 * Checks whether an incoming request can be safely deduplicated.
 * Non-GET methods, explicit bypasses, requests with bodies, or requests with
 * unsupported or unrepresentable options safely bypass deduplication.
 */
function evaluateDeduplicatable(isGet, options) {
  if (!isGet || options.bypassDedup) {
    return false;
  }
  // GET requests with a body are non-standard; bypass deduplication safely
  if (options.body !== undefined && options.body !== null) {
    return false;
  }
  // Check for unknown options or unrepresentable non-primitive option values
  for (const key of Object.keys(options)) {
    if (!KNOWN_REQUEST_OPTIONS.has(key)) {
      // Unsupported or unrepresented fetch option - bypass deduplication safely
      return false;
    }
    if (SUPPORTED_SEMANTIC_FETCH_OPTIONS.includes(key)) {
      const val = options[key];
      if (val !== undefined && typeof val !== 'string' && typeof val !== 'boolean' && typeof val !== 'number') {
        // Complex or non-serializable option value - bypass deduplication
        return false;
      }
    }
  }
  return true;
}

/**
 * Extracts and deterministically sorts supported semantic fetch options.
 */
function extractSemanticFetchOptions(options) {
  const semantic = [];
  for (const key of SUPPORTED_SEMANTIC_FETCH_OPTIONS) {
    if (options[key] !== undefined) {
      semantic.push([key, options[key]]);
    }
  }
  return semantic;
}

/**
 * Detects, validates, and normalizes Authorization headers case-insensitively.
 * Ensures only a single canonical 'Authorization' header remains on headers.
 * If multiple differently cased Authorization headers have conflicting values, throws API_INVALID_HEADERS.
 * Returns { hasAuth: boolean, token: string | null, rawValue: string | null, isSafe: boolean, isExplicitEmpty?: boolean }
 */
function extractAndNormalizeAuthorization(headers) {
  if (!headers || typeof headers !== 'object') {
    return { hasAuth: false, token: null, rawValue: null, isSafe: true };
  }

  const authKeys = Object.keys(headers).filter(
    (k) => k.toLowerCase() === 'authorization'
  );

  if (authKeys.length === 0) {
    return { hasAuth: false, token: null, rawValue: null, isSafe: true };
  }

  const firstKey = authKeys[0];
  const firstValue = headers[firstKey];

  // If multiple differently-cased Authorization properties exist, compare their stringified values
  for (let i = 1; i < authKeys.length; i++) {
    const k = authKeys[i];
    const val = headers[k];
    if (String(firstValue).trim() !== String(val).trim()) {
      const err = new Error('Ambiguous conflicting Authorization headers supplied');
      err.code = 'API_INVALID_HEADERS';
      throw err;
    }
  }

  // Remove all casing variants from the headers object
  for (const k of authKeys) {
    delete headers[k];
  }

  // Handle explicit null or undefined (explicit unauthenticated request)
  if (firstValue === null || firstValue === undefined) {
    return { hasAuth: true, token: null, rawValue: null, isSafe: true, isExplicitEmpty: true };
  }

  // Validate value type: non-string Authorization cannot be safely represented or handled
  if (typeof firstValue !== 'string') {
    return { hasAuth: true, token: null, rawValue: firstValue, isSafe: false };
  }

  const trimmed = firstValue.trim();
  if (trimmed.length === 0) {
    return { hasAuth: true, token: null, rawValue: '', isSafe: false };
  }

  // Extract token from Bearer scheme or treat raw non-empty string as token
  const match = trimmed.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : trimmed;

  // Set single canonical Authorization header, normalizing Bearer scheme casing
  const canonicalAuth = match ? `Bearer ${token}` : trimmed;
  headers.Authorization = canonicalAuth;

  return { hasAuth: true, token, rawValue: canonicalAuth, isSafe: true };
}

/**
 * Builds an option-aware, collision-safe deduplication identity key for in-flight GET requests.
 * Uses a structured JSON array [method, url, authIdentity, skipUnauthorizedHandler, effectiveTimeoutMs, headers, semanticOptions]
 * serialized via JSON.stringify to prevent delimiter and prefix collisions.
 * Auth identity represents the exact effective normalized Authorization header (including scheme)
 * as ['AUTH', effectiveAuth] or ['ANON'].
 * Never logs credentials or sensitive headers.
 */
function buildDeduplicationKey({
  url,
  requestToken,
  skipUnauthorizedHandler = false,
  effectiveTimeoutMs = DEFAULT_TIMEOUT_MS,
  headers = {},
  semanticOptions = null,
  fetchOptions = null,
}) {
  let effectiveAuth = null;

  // Inspect headers case-insensitively for Authorization header
  if (headers && typeof headers === 'object') {
    try {
      const authInfo = extractAndNormalizeAuthorization({ ...headers });
      if (!authInfo.isSafe) {
        return null;
      }
      if (authInfo.hasAuth && authInfo.rawValue) {
        effectiveAuth = authInfo.rawValue;
      }
    } catch (_) {
      // Conflicting or ambiguous Authorization headers - cannot represent safely
      return null;
    }
  }

  // If headers did not contain Authorization, fallback to requestToken if explicitly passed
  if (!effectiveAuth && requestToken !== undefined && requestToken !== null) {
    const trimmed = String(requestToken).trim();
    if (trimmed.length === 0) {
      return null;
    }
    effectiveAuth = trimmed;
  }

  const normalizedHeaders = [];
  if (headers && typeof headers === 'object') {
    const keys = Object.keys(headers).sort((a, b) => {
      const cmp = a.toLowerCase().localeCompare(b.toLowerCase());
      return cmp !== 0 ? cmp : a.localeCompare(b);
    });
    for (const k of keys) {
      const lower = k.toLowerCase();
      // Exclude Authorization (captured by authIdentity) and default Content-Type
      if (lower !== 'authorization' && lower !== 'content-type') {
        normalizedHeaders.push([lower, String(headers[k])]);
      }
    }
  }

  let semanticList = [];
  if (Array.isArray(semanticOptions)) {
    semanticList = [...semanticOptions].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  } else if (fetchOptions && typeof fetchOptions === 'object') {
    semanticList = extractSemanticFetchOptions(fetchOptions);
  }

  const authIdentity = effectiveAuth !== null
    ? ['AUTH', effectiveAuth]
    : ['ANON'];

  return JSON.stringify([
    'GET',
    url,
    authIdentity,
    Boolean(skipUnauthorizedHandler),
    effectiveTimeoutMs,
    normalizedHeaders,
    semanticList,
  ]);
}

// Registry of active in-flight GET requests for safe request deduplication
// Key: JSON.stringify(['GET', url, authIdentity, skipUnauthorizedHandler, effectiveTimeoutMs, headers, semanticOptions])
// Value: {
//   key: string,
//   subscribers: Set<{ resolve, reject, signal, cleanup }>,
//   controller: AbortController | null,
//   isSettled: boolean,
// }
const inFlightGetRequests = new Map();

function clearInFlightRequests() {
  clearResponseCache();
  for (const [key, entry] of inFlightGetRequests.entries()) {
    entry.isSettled = true;
    try {
      if (entry.controller) {
        entry.controller.abort('In-flight requests cleared');
      }
    } catch (_) {}
    for (const sub of Array.from(entry.subscribers)) {
      try {
        if (sub.cleanup) sub.cleanup();
        const err = new Error('In-flight request cancelled due to session reset');
        err.code = 'API_SESSION_RESET';
        err.isSessionReset = true;
        sub.reject(err);
      } catch (_) {}
    }
    entry.subscribers.clear();
  }
  inFlightGetRequests.clear();
}

function getInFlightRequestCount() {
  return inFlightGetRequests.size;
}

function cloneResponse(val) {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  try {
    return JSON.parse(JSON.stringify(val));
  } catch (_) {
    return val;
  }
}

/**
 * Phase 3B.4 Safe API Response Caching Policy Configuration
 * Whitelist-based: only explicitly verified, non-transactional endpoints are cacheable.
 * Business-critical endpoints (inventory, availability, prices, cart, subscription balance/quota,
 * bookings, GPS tracking, transactions) are strictly excluded and never cached.
 */
const CACHEABLE_ENDPOINTS = {
  '/api/v1/customer/categories': {
    ttlMs: 5 * 60 * 1000, // 5 minutes
    isSessionScoped: false,
    maxEntries: 10,
  },
  '/api/v1/customer/subscription/plans': {
    ttlMs: 2 * 60 * 1000, // 2 minutes (tight TTL for pricing freshness)
    isSessionScoped: false,
    maxEntries: 10,
  },
  '/api/v1/customer/profile': {
    ttlMs: 2 * 60 * 1000, // 2 minutes
    isSessionScoped: true, // Strictly customer-session isolated
    maxEntries: 5,
  },
};

const MAX_TOTAL_CACHE_ENTRIES = 25;
const MAX_ENTRY_PAYLOAD_BYTES = 50 * 1024; // 50 KB per-entry serialized ceiling
const MAX_TOTAL_CACHE_BYTES = 200 * 1024;  // 200 KB aggregate serialized payload budget

let globalInvalidationGeneration = 0;
const endpointGenerations = new Map();
let currentCacheBytes = 0;

function getEndpointGeneration(baseEndpoint) {
  return endpointGenerations.get(baseEndpoint) || 0;
}

/**
 * Calculates the exact UTF-8 encoded byte length of a string.
 * Accounts for 1-byte ASCII, 2-byte Latin/Greek/Cyrillic, 3-byte CJK/Indian scripts/Rupee symbol ₹,
 * and 4-byte surrogate pairs/emoji.
 */
function getUtf8ByteLength(str) {
  if (typeof str !== 'string' || !str) {
    return 0;
  }
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(str, 'utf8');
  }
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++; // Skip low surrogate
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function estimatePayloadBytes(data) {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return str ? getUtf8ByteLength(str) : 0;
  } catch (_) {
    return 0;
  }
}

const responseCache = new Map();
const cacheStats = {
  hits: 0,
  misses: 0,
  expirations: 0,
  evictions: 0,
  invalidations: 0,
};

function buildCacheKey({ baseEndpoint, url, requestToken, isSessionScoped }) {
  const sessionIdentity = isSessionScoped
    ? (requestToken ? ['AUTH', String(requestToken).trim()] : ['ANON'])
    : ['SHARED'];
  return JSON.stringify(['CACHE', baseEndpoint, url, sessionIdentity]);
}

function getFromResponseCache(cacheKey) {
  if (!responseCache.has(cacheKey)) {
    return null;
  }
  const entry = responseCache.get(cacheKey);
  const now = Date.now();
  if (now - entry.timestamp > entry.ttlMs) {
    if (entry.byteSize) {
      currentCacheBytes = Math.max(0, currentCacheBytes - entry.byteSize);
    }
    responseCache.delete(cacheKey);
    cacheStats.expirations++;
    return null;
  }
  // Refresh LRU order on access
  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, entry);
  return entry;
}

function saveToResponseCache(cacheKey, entry) {
  const baseEndpoint = entry.baseEndpoint;
  const policy = CACHEABLE_ENDPOINTS[baseEndpoint];
  const byteSize = entry.byteSize || 0;

  // 1. Oversized entry rejection: entries larger than MAX_ENTRY_PAYLOAD_BYTES are not cached
  if (byteSize > MAX_ENTRY_PAYLOAD_BYTES) {
    return false;
  }

  // If replacing existing entry, deduct its byte size and remove to refresh insertion order
  if (responseCache.has(cacheKey)) {
    const existing = responseCache.get(cacheKey);
    if (existing && existing.byteSize) {
      currentCacheBytes = Math.max(0, currentCacheBytes - existing.byteSize);
    }
    responseCache.delete(cacheKey);
  }

  // 2. Per-endpoint maximum entry limit enforcement
  if (policy && policy.maxEntries && !responseCache.has(cacheKey)) {
    const matchingKeys = [];
    for (const [k, e] of responseCache.entries()) {
      if (e.baseEndpoint === baseEndpoint) {
        matchingKeys.push(k);
      }
    }
    if (matchingKeys.length >= policy.maxEntries) {
      const oldestMatchingKey = matchingKeys[0];
      const oldestEntry = responseCache.get(oldestMatchingKey);
      if (oldestEntry && oldestEntry.byteSize) {
        currentCacheBytes = Math.max(0, currentCacheBytes - oldestEntry.byteSize);
      }
      responseCache.delete(oldestMatchingKey);
      cacheStats.evictions++;
    }
  }

  // 3. Global maximum entries limit enforcement
  if (responseCache.size >= MAX_TOTAL_CACHE_ENTRIES && !responseCache.has(cacheKey)) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) {
      const oldestEntry = responseCache.get(oldestKey);
      if (oldestEntry && oldestEntry.byteSize) {
        currentCacheBytes = Math.max(0, currentCacheBytes - oldestEntry.byteSize);
      }
      responseCache.delete(oldestKey);
      cacheStats.evictions++;
    }
  }

  // 4. Global total cache byte budget enforcement
  while ((currentCacheBytes + byteSize > MAX_TOTAL_CACHE_BYTES) && responseCache.size > 0) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) {
      const oldestEntry = responseCache.get(oldestKey);
      if (oldestEntry && oldestEntry.byteSize) {
        currentCacheBytes = Math.max(0, currentCacheBytes - oldestEntry.byteSize);
      }
      responseCache.delete(oldestKey);
      cacheStats.evictions++;
    } else {
      break;
    }
  }

  responseCache.set(cacheKey, entry);
  currentCacheBytes += byteSize;
  return true;
}

function clearResponseCache() {
  globalInvalidationGeneration++;
  endpointGenerations.clear();
  responseCache.clear();
  currentCacheBytes = 0;
  cacheStats.invalidations++;
}

function invalidateResponseCache(target) {
  if (!target) {
    clearResponseCache();
    return;
  }
  // Increment generation for target endpoint and any matching configured endpoints
  endpointGenerations.set(target, (endpointGenerations.get(target) || 0) + 1);
  for (const ep of Object.keys(CACHEABLE_ENDPOINTS)) {
    if (ep === target || ep.includes(target)) {
      endpointGenerations.set(ep, (endpointGenerations.get(ep) || 0) + 1);
    }
  }

  let count = 0;
  for (const [key, entry] of Array.from(responseCache.entries())) {
    if (entry.baseEndpoint === target || key.includes(target)) {
      if (entry.byteSize) {
        currentCacheBytes = Math.max(0, currentCacheBytes - entry.byteSize);
      }
      responseCache.delete(key);
      count++;
    }
  }
  if (count > 0) {
    cacheStats.invalidations += count;
  }
}

function getResponseCacheStats() {
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    expirations: cacheStats.expirations,
    evictions: cacheStats.evictions,
    invalidations: cacheStats.invalidations,
    size: responseCache.size,
    bytes: currentCacheBytes,
    globalGeneration: globalInvalidationGeneration,
  };
}

function resetResponseCacheStats() {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.expirations = 0;
  cacheStats.evictions = 0;
  cacheStats.invalidations = 0;
}

/**
 * Executes a single low-level HTTP network request with timeout, 
 * response stream parsing, and centralized HTTP 401 handling.
 */
async function executeNetworkRequest({
  url,
  endpoint,
  method,
  headers,
  requestToken,
  effectiveTimeoutMs,
  options,
  controller,
  callerSignal = null,
}) {
  const {
    timeoutMs: _unusedTimeoutMs,
    timeout: _unusedTimeout,
    signal: _unusedCallerSignal,
    headers: _unusedCustomHeaders,
    bypassDedup: _unusedBypassDedup,
    bypassCache: _unusedBypassCache,
    skipUnauthorizedHandler: _unusedSkipUnauthorizedHandler,
    ...restFetchOptions
  } = options;

  const fetchOptions = {
    ...restFetchOptions,
    method,
    headers,
    ...(controller ? { signal: controller.signal } : {}),
  };

  let timeoutId = null;
  let didTimeout = false;

  if (controller && effectiveTimeoutMs > 0) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      try {
        controller.abort();
      } catch (_) {}
    }, effectiveTimeoutMs);
  }

  let response;
  let json;

  try {
    if (!controller) {
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

        if (callerSignal) {
          fallbackAbortListener = () => {
            const abortErr = new Error(`Request to ${endpoint} was cancelled by caller (socket not cancelled)`);
            abortErr.code = 'API_ABORTED';
            abortErr.isAborted = true;
            abortErr.networkCancelled = false;
            abortErr.reason = callerSignal.reason || 'Operation cancelled by caller';
            reject(abortErr);
          };
          if (typeof callerSignal.addEventListener === 'function') {
            callerSignal.addEventListener('abort', fallbackAbortListener);
          }
        }
      });

      const fetchAndParse = (async () => {
        const resp = await fetch(url, fetchOptions);
        const parsed = await resp.json().catch(() => ({}));
        return { resp, parsed };
      })();

      try {
        const shouldRace = effectiveTimeoutMs > 0 || Boolean(callerSignal);
        const result = shouldRace
          ? await Promise.race([fetchAndParse, cancellationPromise])
          : await fetchAndParse;
        response = result.resp;
        json = result.parsed;
      } finally {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (fallbackAbortListener && callerSignal && typeof callerSignal.removeEventListener === 'function') {
          callerSignal.removeEventListener('abort', fallbackAbortListener);
        }
      }
    } else {
      response = await fetch(url, fetchOptions);
      try {
        json = await response.json();
      } catch (parseErr) {
        if (didTimeout || parseErr.name === 'AbortError') {
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

    if (err.name === 'AbortError' || err.code === 'API_ABORTED') {
      const abortErr = new Error(`Request to ${endpoint} was aborted`);
      abortErr.code = 'API_ABORTED';
      abortErr.isAborted = true;
      abortErr.networkCancelled = Boolean(controller);
      abortErr.reason = callerSignal?.reason || options.signal?.reason || err.reason || err.message;
      throw abortErr;
    }

    if (err.isNetwork || err.code === 'API_NETWORK_ERROR') {
      throw err;
    }

    const netErr = new Error(err.message || 'Network request failed');
    netErr.code = 'API_NETWORK_ERROR';
    netErr.isNetwork = true;
    netErr.cause = err;
    throw netErr;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  if (!response.ok) {
    const errorMsg = json?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.code = json?.error?.code || 'API_REQUEST_FAILED';
    err.status = response.status;
    err.details = json?.error?.details || [];

    const isAuthEndpoint = !endpoint.includes('/auth/send-otp') && !endpoint.includes('/auth/verify-otp');
    const shouldNotifyUnauthorized = isAuthEndpoint && !options.skipUnauthorizedHandler;
    if (response.status === 401 && shouldNotifyUnauthorized) {
      clearResponseCache();
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

/**
 * Standard API request wrapper with bearer token attachment,
 * centralized AbortController timeout, caller cancellation support,
 * and safe in-flight GET request deduplication.
 */
function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  // Pre-flight check: if caller provided an already aborted signal, abort immediately
  if (options.signal?.aborted) {
    const abortErr = new Error(`Request to ${endpoint} was aborted`);
    abortErr.code = 'API_ABORTED';
    abortErr.isAborted = true;
    abortErr.reason = options.signal.reason || 'Operation aborted by caller';
    return Promise.reject(abortErr);
  }

  // Pre-flight check: validate and normalize Authorization headers case-insensitively
  let authInfo;
  try {
    authInfo = extractAndNormalizeAuthorization(headers);
  } catch (err) {
    return Promise.reject(err);
  }

  // Resolve effective request timeout in milliseconds
  let effectiveTimeoutMs = DEFAULT_TIMEOUT_MS;
  if (options.timeoutMs === 0 || options.timeout === 0 || options.timeoutMs === null || options.timeout === null || options.timeoutMs === false) {
    effectiveTimeoutMs = 0;
  } else if (typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
    effectiveTimeoutMs = options.timeoutMs;
  } else if (typeof options.timeout === 'number' && options.timeout > 0) {
    effectiveTimeoutMs = options.timeout;
  }

  const runWithAuth = async () => {
    let requestToken = null;
    let isAuthSafe = authInfo.isSafe;

    if (authInfo.hasAuth) {
      if (authInfo.isSafe && authInfo.token) {
        requestToken = authInfo.token;
      } else if (!authInfo.isSafe) {
        isAuthSafe = false;
      }
      // If authInfo.isExplicitEmpty, requestToken stays null and Keystore is not read
    } else {
      // No caller Authorization supplied: retrieve credentials from secure Keystore
      try {
        const tokens = await getAuthTokens();
        if (tokens && tokens.token) {
          requestToken = tokens.token;
          headers.Authorization = `Bearer ${tokens.token}`;
        }
      } catch (e) {
        console.warn('[API CLIENT] Could not read keystore credentials', e);
      }
    }

    // Post-auth check: if caller signal was aborted while awaiting keystore credentials
    if (options.signal?.aborted) {
      const abortErr = new Error(`Request to ${endpoint} was aborted`);
      abortErr.code = 'API_ABORTED';
      abortErr.isAborted = true;
      abortErr.reason = options.signal.reason || 'Operation aborted by caller';
      throw abortErr;
    }

    // Phase 3B.4 Safe Response Cache Evaluation
    const baseEndpoint = endpoint.split('?')[0];
    const cachePolicy = isGet ? CACHEABLE_ENDPOINTS[baseEndpoint] : null;

    // Capture invalidation generations at request evaluation time
    const requestGlobalGen = globalInvalidationGeneration;
    const requestEndpointGen = getEndpointGeneration(baseEndpoint);
    const shouldReadCache = Boolean(
      isGet &&
      !options.bypassCache &&
      !options.skipUnauthorizedHandler &&
      cachePolicy &&
      isAuthSafe
    );
    const shouldWriteCache = Boolean(
      isGet &&
      !options.skipUnauthorizedHandler &&
      cachePolicy &&
      isAuthSafe
    );

    const cacheKey = (shouldReadCache || shouldWriteCache)
      ? buildCacheKey({
          baseEndpoint,
          url,
          requestToken,
          isSessionScoped: cachePolicy.isSessionScoped,
        })
      : null;

    if (shouldReadCache && cacheKey) {
      const cached = getFromResponseCache(cacheKey);
      if (cached) {
        cacheStats.hits++;
        return cloneResponse(cached.data);
      }
      cacheStats.misses++;
    }

    // In-flight GET deduplication evaluation
    // Deduplicate strictly for GET requests with valid, supported options and safe authorization
    const isDeduplicatable = isAuthSafe && evaluateDeduplicatable(isGet, options);
    const dedupKey = isDeduplicatable
      ? buildDeduplicationKey({
          url,
          requestToken,
          skipUnauthorizedHandler: Boolean(options.skipUnauthorizedHandler),
          effectiveTimeoutMs,
          headers,
          fetchOptions: options,
        })
      : null;

    if (!dedupKey) {
      // Non-GET mutation, bypassDedup, or unrepresented options: direct execution with its own controller
      const hasAbortController = typeof AbortController !== 'undefined';
      const controller = hasAbortController ? new AbortController() : null;
      let callerAbortListener = null;

      if (controller && options.signal) {
        callerAbortListener = () => {
          try {
            controller.abort(options.signal.reason);
          } catch (_) {}
        };
        if (typeof options.signal.addEventListener === 'function') {
          options.signal.addEventListener('abort', callerAbortListener);
        }
      }

      try {
        const netRes = await executeNetworkRequest({
          url,
          endpoint,
          method,
          headers,
          requestToken,
          effectiveTimeoutMs,
          options,
          controller,
          callerSignal: controller ? null : (options.signal || null),
        });
        const isGenerationValid =
          requestGlobalGen === globalInvalidationGeneration &&
          requestEndpointGen === getEndpointGeneration(baseEndpoint);

        if (shouldWriteCache && cacheKey && isGenerationValid && netRes && netRes.success !== false) {
          const byteSize = estimatePayloadBytes(netRes);
          saveToResponseCache(cacheKey, {
            data: cloneResponse(netRes),
            timestamp: Date.now(),
            ttlMs: cachePolicy.ttlMs,
            baseEndpoint,
            sessionScoped: cachePolicy.isSessionScoped,
            requestToken: cachePolicy.isSessionScoped ? requestToken : null,
            byteSize,
          });
        }
        return netRes;
      } finally {
        if (callerAbortListener && options.signal && typeof options.signal.removeEventListener === 'function') {
          options.signal.removeEventListener('abort', callerAbortListener);
        }
      }
    }

    // In-flight GET deduplication: either join existing active entry or create new initiator entry
    let entry = inFlightGetRequests.get(dedupKey);
    // If entry is settled or marked inactive, do not join; create fresh entry
    if (entry && entry.isSettled) {
      entry = null;
    }
    const isInitiator = !entry;

    if (isInitiator) {
      const hasAbortController = typeof AbortController !== 'undefined';
      const controller = hasAbortController ? new AbortController() : null;

      entry = {
        key: dedupKey,
        subscribers: new Set(),
        controller,
        isSettled: false,
      };
      inFlightGetRequests.set(dedupKey, entry);

      // Launch underlying network fetch in background to serve all subscribers
      (async () => {
        try {
          const json = await executeNetworkRequest({
            url,
            endpoint,
            method,
            headers,
            requestToken,
            effectiveTimeoutMs,
            options,
            controller,
            callerSignal: null, // Shared network request MUST NOT inherit initiating subscriber's signal
          });

          const isGenerationValid =
            requestGlobalGen === globalInvalidationGeneration &&
            requestEndpointGen === getEndpointGeneration(baseEndpoint);

          if (shouldWriteCache && cacheKey && isGenerationValid && json && json.success !== false) {
            const byteSize = estimatePayloadBytes(json);
            saveToResponseCache(cacheKey, {
              data: cloneResponse(json),
              timestamp: Date.now(),
              ttlMs: cachePolicy.ttlMs,
              baseEndpoint,
              sessionScoped: cachePolicy.isSessionScoped,
              requestToken: cachePolicy.isSessionScoped ? requestToken : null,
              byteSize,
            });
          }

          entry.isSettled = true;
          for (const sub of Array.from(entry.subscribers)) {
            entry.subscribers.delete(sub);
            if (sub.cleanup) sub.cleanup();
            sub.resolve(cloneResponse(json));
          }
        } catch (err) {
          entry.isSettled = true;
          for (const sub of Array.from(entry.subscribers)) {
            entry.subscribers.delete(sub);
            if (sub.cleanup) sub.cleanup();
            sub.reject(err);
          }
        } finally {
          entry.isSettled = true;
          // Stale-entry protection: delete only if this exact entry is still current in registry
          if (inFlightGetRequests.get(dedupKey) === entry) {
            inFlightGetRequests.delete(dedupKey);
          }
        }
      })();
    }

    // Every caller (initiator or subscriber) subscribes to entry
    return new Promise((resolve, reject) => {
      const sub = {
        resolve,
        reject,
        signal: options.signal,
        cleanup: null,
      };

      if (options.signal) {
        if (options.signal.aborted) {
          const abortErr = new Error(`Request to ${endpoint} was aborted`);
          abortErr.code = 'API_ABORTED';
          abortErr.isAborted = true;
          abortErr.networkCancelled = Boolean(entry.controller);
          abortErr.reason = options.signal.reason || 'Operation aborted by caller';
          return reject(abortErr);
        }

        const onCallerAbort = () => {
          entry.subscribers.delete(sub);
          if (sub.cleanup) sub.cleanup();
          const abortErr = new Error(`Request to ${endpoint} was aborted`);
          abortErr.code = 'API_ABORTED';
          abortErr.isAborted = true;
          abortErr.networkCancelled = Boolean(entry.controller);
          abortErr.reason = options.signal.reason || 'Operation aborted by caller';
          reject(abortErr);

          // If no subscribers remain listening, abort the underlying fetch
          if (entry.subscribers.size === 0 && !entry.isSettled) {
            if (entry.controller) {
              try {
                entry.controller.abort(options.signal.reason);
              } catch (_) {}
              entry.isSettled = true;
              if (inFlightGetRequests.get(dedupKey) === entry) {
                inFlightGetRequests.delete(dedupKey);
              }
            }
          }
        };

        if (typeof options.signal.addEventListener === 'function') {
          options.signal.addEventListener('abort', onCallerAbort);
          sub.cleanup = () => {
            options.signal.removeEventListener('abort', onCallerAbort);
          };
        }
      }

      entry.subscribers.add(sub);
    });
  };

  return runWithAuth();
}

export const api = {
  /**
   * Safe request deduplication management
   */
  request: (endpoint, options) => request(endpoint, options),
  clearInFlightRequests,
  getInFlightRequestCount,
  buildDeduplicationKey,
  extractAndNormalizeAuthorization,
  setUnauthorizedHandler: (cb) => setUnauthorizedHandler(cb),

  /**
   * Phase 3B.4 Safe response caching management
   */
  clearResponseCache,
  invalidateResponseCache,
  getResponseCacheStats,
  resetResponseCacheStats,
  getResponseCacheSize: () => responseCache.size,
  getCacheBytes: () => currentCacheBytes,
  getInvalidationGeneration: (ep) => (ep ? getEndpointGeneration(ep) : globalInvalidationGeneration),
  getCachePolicy: (ep) => (ep ? CACHEABLE_ENDPOINTS[ep] || null : { ...CACHEABLE_ENDPOINTS }),
  buildCacheKey,
  getUtf8ByteLength,
  estimatePayloadBytes,
  MAX_TOTAL_CACHE_ENTRIES,
  MAX_ENTRY_PAYLOAD_BYTES,
  MAX_TOTAL_CACHE_BYTES,

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
    const res = await request('/api/v1/customer/profile', {
      ...options,
      method: 'PUT',
      headers,
      body: JSON.stringify({ name, age, area }),
    });
    if (res && res.success !== false) {
      invalidateResponseCache('/api/v1/customer/profile');
    }
    return res;
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
    const res = await request('/api/v1/customer/subscription/purchase', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
    if (res && res.success !== false) {
      invalidateResponseCache('/api/v1/customer/subscription/plans');
    }
    return res;
  },

  /**
   * Verify Razorpay payment signature and activate subscription
   * POST /api/v1/customer/subscription/verify
   * @param {object} params
   */
  async verifySubscriptionPayment({ planId, razorpayOrderId, razorpayPaymentId, razorpaySignature }, options = {}) {
    const res = await request('/api/v1/customer/subscription/verify', {
      ...options,
      method: 'POST',
      body: JSON.stringify({
        planId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      }),
    });
    if (res && res.success !== false) {
      invalidateResponseCache('/api/v1/customer/subscription/plans');
    }
    return res;
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



