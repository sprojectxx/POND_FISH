/**
 * Physical Transaction Calculation & Preview Endpoint
 * POST /api/v1/customer/bills/scans/{id}/preview
 * Traceability: PondFish API Specification v1 (Section 27), Master PRD v2 (Section 6.1)
 * 
 * Computes server-authoritative preview of subscription allowance, monetary credit applied,
 * extra payable amount, and 2% + 18% GST gateway fees. Zero financial mutations.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../../../lib/engines/customer');
const { calculatePhysicalBillPreview } = require('../../../../../../../../lib/engines/billing-correction');

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
    const items = body?.items || [];

    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Scan ID is required.' } },
        { status: 400 }
      );
    }

    const preview = await calculatePhysicalBillPreview({
      billId,
      customerId: session.customerId,
      items,
    });

    return NextResponse.json({
      success: true,
      data: preview,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[BILL PREVIEW ERROR]', error);
    let status = 500;
    if (error.code === 'UNAUTHORIZED') status = 401;
    else if (error.code === 'FORBIDDEN') status = 403;
    else if (error.code === 'BILL_NOT_FOUND') status = 404;
    else if (error.code === 'BILL_ALREADY_PROCESSED') status = 409;

    return NextResponse.json(
      { success: false, error: { code: error.code || 'SERVER_ERROR', message: error.message } },
      { status }
    );
  }
}
