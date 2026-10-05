/**
 * Manual Bill ID Fallback API Endpoint
 * POST /api/v1/customer/bills/scans/{id}/bill-number
 * Traceability: PondFish API Specification v1 (Section 21), Master PRD v2 (Section 8.3)
 * 
 * Allows customer or worker to supply a manual Bill ID when AI OCR is missing or unreadable.
 * Enforces duplicate processed bill check.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../../../lib/engines/customer');
const { setManualBillNumber } = require('../../../../../../../../lib/engines/billing-correction');

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

export async function POST(request, { params }) {
  try {
    const session = authenticateRequest(request);
    const billId = params?.id;
    const body = await request.json().catch(() => ({}));
    const billNumber = body?.bill_number || body?.billNumber;

    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Scan ID is required.' } },
        { status: 400 }
      );
    }

    if (!billNumber || typeof billNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'BILL_NUMBER_REQUIRED', message: 'Please enter a valid Bill ID.' } },
        { status: 400 }
      );
    }

    const result = await setManualBillNumber({
      billId,
      billNumber,
      customerId: session.customerId,
    });

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SET BILL NUMBER ERROR]', error);
    let status = 500;
    if (error.code === 'UNAUTHORIZED') status = 401;
    else if (error.code === 'FORBIDDEN') status = 403;
    else if (error.code === 'BILL_NOT_FOUND') status = 404;
    else if (error.code === 'BILL_ALREADY_PROCESSED') status = 409;
    else if (error.code === 'INVALID_BILL_NUMBER_FORMAT' || error.code === 'INVALID_BILL_NUMBER') status = 400;

    return NextResponse.json(
      { success: false, error: { code: error.code || 'SERVER_ERROR', message: error.message } },
      { status }
    );
  }
}
