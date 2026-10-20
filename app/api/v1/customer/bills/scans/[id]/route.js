/**
 * Bill Extraction Status Endpoint
 * GET /api/v1/customer/bills/scans/{id}
 * Traceability: PondFish API Specification v1 (Section 20)
 * 
 * Returns extracted bill details, items, confidence, and status.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../../lib/engines/customer');
const billRepository = require('../../../../../../../lib/db/repositories/billRepository');

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
    const billId = params?.id;

    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Scan ID is required.' } },
        { status: 400 }
      );
    }

    const bill = await billRepository.getBillById(billId);
    if (!bill) {
      return NextResponse.json(
        { success: false, error: { code: 'BILL_NOT_FOUND', message: 'Scanned bill not found.' } },
        { status: 404 }
      );
    }

    if (bill.customer_id !== session.customerId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized access to this bill.' } },
        { status: 403 }
      );
    }

    const effectiveBillNumber = bill.manual_bill_id || bill.bill_number;

    return NextResponse.json({
      success: true,
      data: {
        scan_id: bill.id,
        bill_id: bill.id,
        bill_number: effectiveBillNumber,
        bill_number_missing: !effectiveBillNumber,
        image_url: bill.image_url,
        confidence_score: bill.ai_confidence_score,
        status: bill.status,
        created_at: bill.created_at,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET BILL SCAN ERROR]', error);
    const status = error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json(
      { success: false, error: { code: error.code || 'SERVER_ERROR', message: error.message } },
      { status }
    );
  }
}
