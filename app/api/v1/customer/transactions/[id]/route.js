/**
 * Customer Single Transaction Receipt Endpoint
 * GET /api/v1/customer/transactions/{id}
 * Traceability: PondFish API Specification v1 (Section 41), Customer UI Spec (Section 72)
 * 
 * Returns full transaction receipt details for a specific customer transaction.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { getCustomerTransactionById } = require('../../../../../../lib/db/repositories/transactionRepository');

export const dynamic = 'force-dynamic';

function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('A valid customer session is required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  let session;
  try {
    session = verifySessionToken(token);
  } catch {
    const err = new Error('Invalid or expired authentication session.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (session.role !== 'CUSTOMER') {
    const err = new Error('Forbidden: Only customers can access this endpoint.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return session;
}

export async function GET(request, { params }) {
  try {
    const session = authenticateRequest(request);
    const transactionId = params?.id;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Transaction ID is required.' } },
        { status: 400 }
      );
    }

    const transaction = await getCustomerTransactionById(transactionId, session.customerId);
    if (!transaction) {
      return NextResponse.json(
        { success: false, error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction record not found.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transaction,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET CUSTOMER TRANSACTION BY ID ERROR]', error);
    const status = error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json(
      { success: false, error: { code: error.code || 'SERVER_ERROR', message: error.message } },
      { status }
    );
  }
}
