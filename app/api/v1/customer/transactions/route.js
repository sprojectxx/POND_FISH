/**
 * Customer Transactions History Endpoint
 * GET /api/v1/customer/transactions
 * Traceability: PondFish API Specification v1 (Section 41), Customer UI Spec (Section 71-74)
 * 
 * Returns paginated list of completed physical store purchases and online bookings for the customer.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../lib/engines/customer');
const { getCustomerTransactions } = require('../../../../../lib/db/repositories/transactionRepository');

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

export async function GET(request) {
  try {
    const session = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const transactions = await getCustomerTransactions(session.customerId, { limit, offset });

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        limit,
        offset,
        count: transactions.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET CUSTOMER TRANSACTIONS ERROR]', error);
    const status = error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json(
      { success: false, error: { code: error.code || 'SERVER_ERROR', message: error.message } },
      { status }
    );
  }
}
