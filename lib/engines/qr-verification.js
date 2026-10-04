/**
 * Engine 10: QR Ticket Verification Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 15) & PRD (Section 13)
 * Secure cryptographic QR booking ticket generation and validation.
 * Never exposes customer PII directly in QR data.
 */

const crypto = require('crypto');

const QR_SECRET = process.env.SESSION_SECRET || 'pondfish-qr-ticket-secret-key-production';

/**
 * Generate secure, cryptographically verifiable booking QR ticket payload
 * @param {object} booking - { id, booking_code, customer_id, created_at }
 * @returns {string} Signed token format: PFQR.<payloadBase64>.<hmacSig>
 */
function generateBookingQrData(booking) {
  const payload = {
    b: booking.id,
    c: booking.booking_code,
    t: new Date(booking.created_at || Date.now()).getTime(),
    v: 1, // QR format version
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return `PFQR.${payloadStr}.${signature}`;
}

/**
 * Verify integrity of a QR booking ticket
 * @param {string} qrCodeData
 * @returns {{ valid: boolean, payload: object|null, error: string|null }}
 */
function verifyBookingQrData(qrCodeData) {
  if (!qrCodeData || typeof qrCodeData !== 'string' || !qrCodeData.startsWith('PFQR.')) {
    return { valid: false, payload: null, error: 'INVALID_QR_FORMAT' };
  }

  const parts = qrCodeData.split('.');
  if (parts.length !== 3) {
    return { valid: false, payload: null, error: 'MALFORMED_QR_TOKEN' };
  }

  const [, payloadStr, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payloadStr)
    .digest('base64url');

  if (signature !== expectedSig) {
    return { valid: false, payload: null, error: 'QR_SIGNATURE_MISMATCH' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    return { valid: true, payload: decoded, error: null };
  } catch {
    return { valid: false, payload: null, error: 'CORRUPTED_QR_PAYLOAD' };
  }
}

module.exports = {
  name: 'QrVerificationEngine',
  generateBookingQrData,
  verifyBookingQrData,
};
