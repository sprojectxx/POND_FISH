const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const qrEngine = require('../../lib/engines/qr-verification');

describe('Engine 10: QR Verification Engine', () => {
  const sampleBooking = {
    id: 'bkg-test-123',
    booking_code: 'PF-2026-9999',
    customer_id: 'cust-456',
    created_at: new Date('2026-10-11T12:00:00Z'),
  };

  it('generates properly formatted signed QR token', () => {
    const token = qrEngine.generateBookingQrData(sampleBooking);
    assert.ok(typeof token === 'string');
    assert.ok(token.startsWith('PFQR.'));

    const parts = token.split('.');
    assert.strictEqual(parts.length, 3, 'Token must contain 3 dot-separated segments');
    assert.strictEqual(parts[0], 'PFQR');
    assert.ok(parts[1].length > 0, 'Payload segment must not be empty');
    assert.ok(parts[2].length > 0, 'Signature segment must not be empty');
  });

  it('successfully verifies an authentic QR token', () => {
    const token = qrEngine.generateBookingQrData(sampleBooking);
    const result = qrEngine.verifyBookingQrData(token);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.error, null);
    assert.ok(result.payload);
    assert.strictEqual(result.payload.b, sampleBooking.id);
    assert.strictEqual(result.payload.c, sampleBooking.booking_code);
    assert.strictEqual(result.payload.v, 1);
  });

  it('rejects tampered QR signature', () => {
    const token = qrEngine.generateBookingQrData(sampleBooking);
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.invalidSignature12345`;

    const result = qrEngine.verifyBookingQrData(tamperedToken);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error, 'QR_SIGNATURE_MISMATCH');
    assert.strictEqual(result.payload, null);
  });

  it('rejects tokens with non-PFQR prefix or malformed structure', () => {
    const invalidPrefix = 'XYZ.payload.sig';
    assert.strictEqual(qrEngine.verifyBookingQrData(invalidPrefix).error, 'INVALID_QR_FORMAT');

    const malformed = 'PFQR.onlytwoparts';
    assert.strictEqual(qrEngine.verifyBookingQrData(malformed).error, 'MALFORMED_QR_TOKEN');

    assert.strictEqual(qrEngine.verifyBookingQrData(null).error, 'INVALID_QR_FORMAT');
    assert.strictEqual(qrEngine.verifyBookingQrData('').error, 'INVALID_QR_FORMAT');
  });
});
