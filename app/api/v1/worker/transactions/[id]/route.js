/**
 * Worker Transaction Details Endpoint
 * GET /api/v1/worker/transactions/[id]
 * Traceability: PondFish Worker Portal Spec (WP-10)
 * Retrieves authoritative transaction details, line items, customer info, and worker attribution
 * for the tablet completion & receipt screen.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken } = require('../../../../../../lib/engines/worker');
const workerRepository = require('../../../../../../lib/db/repositories/workerRepository');
const transactionRepository = require('../../../../../../lib/db/repositories/transactionRepository');
const billRepository = require('../../../../../../lib/db/repositories/billRepository');

export const dynamic = 'force-dynamic';

async function authenticateWorkerRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('A valid worker authentication token is required.');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  const token = authHeader.substring(7).trim();
  const session = verifyWorkerSessionToken(token);

  const worker = await workerRepository.findWorkerById(session.workerId);
  if (!worker || !worker.active) {
    const err = new Error('Worker account is disabled or not found.');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  return worker;
}

export async function GET(request, { params }) {
  try {
    const worker = await authenticateWorkerRequest(request);
    const transactionId = params?.id;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Transaction ID is required.' } },
        { status: 400 }
      );
    }

    const tx = await transactionRepository.getTransactionById(transactionId);
    if (!tx) {
      return NextResponse.json(
        { success: false, error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction record not found.' } },
        { status: 404 }
      );
    }

    let billNumber = null;
    if (tx.bill_id || tx.billId) {
      const bill = await billRepository.getBillById(tx.bill_id || tx.billId);
      if (bill) {
        billNumber = bill.manual_bill_id || bill.bill_number;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...tx,
        billNumber: billNumber || tx.bookingCode || tx.transactionNumber,
        workerAttribution: {
          workerId: worker.id,
          workerName: worker.name,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || (error.code === 'FORBIDDEN' ? 403 : error.code === 'UNAUTHORIZED' ? 401 : 500);
    console.error('[API ERROR] GET /api/v1/worker/transactions/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'TRANSACTION_FETCH_FAILED',
          message: error.message || 'Unable to retrieve transaction details.',
        },
      },
      { status }
    );
  }
}
