/**
 * Bill Confirmation & Duplicate Verification Endpoint
 * POST /api/v1/customer/bills/scans/{id}/confirm
 * Traceability: PondFish API Specification v1 (Sections 22, 23)
 * 
 * Verifies that the bill ID has not already been processed and confirms readiness for payment.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../../../lib/engines/customer');
const billRepository = require('../../../../../../../../lib/db/repositories/billRepository');

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

    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Scan ID is required.' } },
        { status: 400 }
      );
    }

    const bill = await billRepository.getBillById(billId);
    if (!bill) {
      return NextResponse.json(
        { success: false, error: { code: 'BILL_NOT_FOUND', message: 'Bill record not found.' } },
        { status: 404 }
      );
    }

    if (bill.customer_id !== session.customerId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized access to this bill.' } },
        { status: 403 }
      );
    }

    if (bill.status === 'PROCESSED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BILL_ALREADY_PROCESSED',
            message: 'This bill has already been processed successfully.',
          },
        },
        { status: 409 }
      );
    }

    const effectiveBillNumber = bill.manual_bill_id || bill.bill_number;
    if (!effectiveBillNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BILL_NUMBER_REQUIRED',
            message: 'A valid Bill ID is required before confirmation.',
          },
        },
        { status: 400 }
      );
    }

    const isDuplicate = await billRepository.isBillNumberAlreadyProcessed(effectiveBillNumber, billId);
    if (isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BILL_ALREADY_PROCESSED',
            message: 'This bill has already been processed successfully.',
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        bill_id: bill.id,
        bill_number: effectiveBillNumber,
        status: 'CONFIRMED',
        message: 'Bill verified and ready for payment finalization.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CONFIRM BILL ERROR]', error);
    const status = error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json(
      { success: false, error: { code: error.code || 'SERVER_ERROR', message: error.message } },
      { status }
    );
  }
}
