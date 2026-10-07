/**
 * Customer Authentication & Profile Business Engine
 * Traceability: PondFish Core Business Engines Spec (Section 5) & Integration Spec (Section 6)
 * Handles customer identification, Firebase Phone Auth verification, session token issuance,
 * and profile completeness state machine.
 */

const jwt = require('jsonwebtoken');
const customerRepository = require('../db/repositories/customerRepository');
const { verifyIdToken } = require('../adapters/firebase/admin');
const { isValidIndianMobile } = require('../validators/common');

// Server-only JWT Secret for PondFish session tokens
const JWT_SECRET = process.env.JWT_SECRET || 'pondfish-customer-session-secret-key-2026';
const TOKEN_EXPIRY = '30d';

/**
 * Checks if a customer profile contains required information
 * @param {object} customer
 * @returns {boolean}
 */
function isProfileComplete(customer) {
  if (!customer) return false;
  const hasName = Boolean(customer.name && customer.name.trim().length >= 2);
  const hasArea = Boolean(customer.area && customer.area.trim().length >= 2);
  const hasAge = customer.age !== null && customer.age !== undefined && customer.age >= 18;
  return Boolean(hasName && hasArea && hasAge);
}

/**
 * Signs a PondFish application session token
 * @param {object} customer
 * @returns {string}
 */
function generateSessionToken(customer) {
  return jwt.sign(
    {
      customerId: customer.id,
      mobileNumber: customer.mobile_number,
      role: 'CUSTOMER',
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Verifies a PondFish application session token
 * @param {string} token
 * @returns {object} Decoded payload
 */
function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('INVALID_SESSION_TOKEN');
  }
}

/**
 * Primary domain entry: Authenticate customer via Firebase Phone Auth ID token
 * @param {object} params
 * @param {string} params.mobileNumber - 10-digit Indian mobile number
 * @param {string} params.idToken - Real Firebase ID Token from mobile client
 * @returns {Promise<{ token: string, customer: object, isProfileComplete: boolean }>}
 */
async function authenticateCustomer({ mobileNumber, idToken }) {
  if (!mobileNumber || !isValidIndianMobile(mobileNumber)) {
    const err = new Error('INVALID_MOBILE_NUMBER');
    err.code = 'INVALID_MOBILE_NUMBER';
    throw err;
  }

  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    const err = new Error('MISSING_FIREBASE_ID_TOKEN');
    err.code = 'MISSING_FIREBASE_ID_TOKEN';
    throw err;
  }

  const cleanedMobile = customerRepository.sanitizeMobile(mobileNumber);

  // Real Firebase Admin SDK verification - strictly enforce valid token
  let decoded;
  try {
    decoded = await verifyIdToken(idToken.trim());
  } catch (firebaseErr) {
    console.error('[FIREBASE VERIFICATION ERROR]', firebaseErr.message);
    const err = new Error(`FIREBASE_VERIFICATION_FAILED: ${firebaseErr.message}`);
    err.code = 'FIREBASE_VERIFICATION_FAILED';
    throw err;
  }

  // Ensure phone number in token matches the claimed mobile number
  if (decoded && decoded.phone_number) {
    const tokenPhone = customerRepository.sanitizeMobile(decoded.phone_number);
    if (tokenPhone !== cleanedMobile) {
      const err = new Error('PHONE_NUMBER_MISMATCH');
      err.code = 'PHONE_NUMBER_MISMATCH';
      throw err;
    }
  }

  // Find existing customer or create a new record
  let customer = await customerRepository.findCustomerByMobile(cleanedMobile);

  if (!customer) {
    // New customer registration
    customer = await customerRepository.createCustomer({
      mobileNumber: cleanedMobile,
    });
  }

  const complete = isProfileComplete(customer);
  const sessionToken = generateSessionToken(customer);

  return {
    token: sessionToken,
    customer: {
      id: customer.id,
      mobileNumber: customer.mobile_number,
      name: customer.name,
      age: customer.age,
      area: customer.area,
      createdAt: customer.created_at,
    },
    isProfileComplete: complete,
  };
}

/**
 * Retrieve customer profile by ID
 * @param {string} customerId
 * @returns {Promise<object|null>}
 */
async function getCustomerProfile(customerId) {
  const customer = await customerRepository.findCustomerById(customerId);
  if (!customer) return null;

  return {
    id: customer.id,
    mobileNumber: customer.mobile_number,
    name: customer.name,
    age: customer.age,
    area: customer.area,
    createdAt: customer.created_at,
    isProfileComplete: isProfileComplete(customer),
  };
}

/**
 * Update customer profile details
 * @param {string} customerId
 * @param {object} profileData
 * @param {string} profileData.name
 * @param {number} profileData.age
 * @param {string} profileData.area
 * @returns {Promise<object>}
 */
async function updateCustomerProfile(customerId, { name, age, area }) {
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
    throw new Error('INVALID_NAME');
  }

  if (age !== undefined) {
    const numAge = Number(age);
    if (isNaN(numAge) || numAge < 18 || numAge > 120) {
      throw new Error('INVALID_AGE');
    }
  }

  if (area !== undefined && (typeof area !== 'string' || area.trim().length < 2)) {
    throw new Error('INVALID_AREA');
  }

  const updated = await customerRepository.updateCustomerProfile(customerId, {
    name: name ? name.trim() : undefined,
    age: age !== undefined ? Number(age) : undefined,
    area: area ? area.trim() : undefined,
  });

  if (!updated) {
    throw new Error('CUSTOMER_NOT_FOUND');
  }

  return {
    id: updated.id,
    mobileNumber: updated.mobile_number,
    name: updated.name,
    age: updated.age,
    area: updated.area,
    updatedAt: updated.updated_at,
    isProfileComplete: isProfileComplete(updated),
  };
}

/**
 * List customers for Admin management with search, subscription status, and blocked state
 * @param {object} filters
 * @returns {Promise<Array>}
 */
async function listCustomersForAdmin(filters = {}) {
  const [customers, blockedSet] = await Promise.all([
    customerRepository.listAdminCustomers(filters),
    customerRepository.getBlockedCustomerIds(),
  ]);

  return customers.map((c) => ({
    ...c,
    isBlocked: blockedSet.has(c.id),
    status: blockedSet.has(c.id) ? 'BLOCKED' : 'ACTIVE',
  }));
}

/**
 * Get comprehensive customer profile with subscriptions, bookings, and transactions
 * @param {string} id
 * @returns {Promise<object>}
 */
async function getCustomerDetailsForAdmin(id) {
  const [profile, blockedSet] = await Promise.all([
    customerRepository.getCustomerDetailedProfile(id),
    customerRepository.getBlockedCustomerIds(),
  ]);

  if (!profile) {
    const err = new Error('Customer not found.');
    err.code = 'CUSTOMER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return {
    ...profile,
    isBlocked: blockedSet.has(profile.customer.id),
    status: blockedSet.has(profile.customer.id) ? 'BLOCKED' : 'ACTIVE',
  };
}

/**
 * Update customer blocked/active status with audit logging
 * @param {string} id
 * @param {object} params
 * @param {boolean} params.blocked
 * @param {object} [context]
 * @returns {Promise<object>}
 */
async function setCustomerStatus(id, { blocked }, { actorId = 'system', ip = 'unknown' } = {}) {
  const auditEngine = require('./audit');
  const customer = await customerRepository.findCustomerById(id);
  if (!customer) {
    const err = new Error('Customer not found.');
    err.code = 'CUSTOMER_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const isBlocked = await customerRepository.setCustomerBlockedState(id, Boolean(blocked));

  await auditEngine.recordAuditLog({
    actorType: 'ADMIN',
    actorId,
    action: isBlocked ? 'CUSTOMER_BLOCKED' : 'CUSTOMER_UNBLOCKED',
    entityType: 'CUSTOMER',
    entityId: id,
    payload: {
      customerId: id,
      mobileNumber: customer.mobile_number,
      isBlocked,
      ip,
    },
  });

  return {
    id,
    isBlocked,
    status: isBlocked ? 'BLOCKED' : 'ACTIVE',
    message: isBlocked ? 'Customer account has been blocked.' : 'Customer account has been reactivated.',
  };
}

module.exports = {
  name: 'CustomerEngine',
  isProfileComplete,
  generateSessionToken,
  verifySessionToken,
  authenticateCustomer,
  getCustomerProfile,
  updateCustomerProfile,
  listCustomersForAdmin,
  getCustomerDetailsForAdmin,
  setCustomerStatus,
};
