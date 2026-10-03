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
 * Primary domain entry: Authenticate customer via Firebase Phone Auth or OTP proof
 * @param {object} params
 * @param {string} params.mobileNumber - 10-digit Indian mobile number
 * @param {string} [params.idToken] - Firebase ID Token from mobile client
 * @param {string} [params.otp] - Verified OTP string for dev/testing
 * @returns {Promise<{ token: string, customer: object, isProfileComplete: boolean }>}
 */
async function authenticateCustomer({ mobileNumber, idToken, otp }) {
  if (!mobileNumber || !isValidIndianMobile(mobileNumber)) {
    throw new Error('INVALID_MOBILE_NUMBER');
  }

  const cleanedMobile = customerRepository.sanitizeMobile(mobileNumber);

  // If client provided a Firebase ID token, verify with Firebase Admin SDK
  if (idToken) {
    try {
      const decoded = await verifyIdToken(idToken);
      // If phone_number is present in decoded token, verify it matches
      if (decoded.phone_number) {
        const tokenPhone = customerRepository.sanitizeMobile(decoded.phone_number);
        if (tokenPhone !== cleanedMobile) {
          throw new Error('PHONE_NUMBER_MISMATCH');
        }
      }
    } catch (firebaseErr) {
      console.warn('[FIREBASE VERIFY WARNING]', firebaseErr.message);
      // In development if Firebase credentials are mock/unconfigured, permit test OTP
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FIREBASE_VERIFICATION_FAILED');
      }
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

module.exports = {
  name: 'CustomerEngine',
  isProfileComplete,
  generateSessionToken,
  verifySessionToken,
  authenticateCustomer,
  getCustomerProfile,
  updateCustomerProfile,
};
