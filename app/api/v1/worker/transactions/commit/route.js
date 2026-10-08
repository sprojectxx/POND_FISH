/**
 * Worker Counter Physical Purchase Commit & Financial Finalization Endpoint
 * POST /api/v1/worker/transactions/commit
 * Traceability: PondFish Worker Portal Spec (WP-09) & Master PRD v2 (Sections 6, 7, 11)
 * 
 * Invokes authoritative single engine: finalizePhysicalPurchaseAtomic() from pos-finalization.js.
 * Passes verified worker ID, customer ID, items, and supports CASH (worker-assisted only)
 * and RAZORPAY online payments. Enforces duplicate bill protection and ledger atomicity.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken } = require('../../../../../../lib/engines/worker');
const workerRepository = require('../../../../../../lib/db/repositories/workerRepository');
const customerRepository = require('../../../../../../lib/db/repositories/customerRepository');
const { finalizePhysicalPurchaseAtomic } = require('../../../../../../lib/engines/pos-finalization');

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

export async function POST(request) {
  try {
    const worker = await authenticateWorkerRequest(request);
    const body = await request.json().catch(() => ({}));

    const {
      billId,
      customerId,
      paymentMethod = 'CASH',
      razorpayPaymentId = null,
      razorpayOrderId = null,
      razorpaySignature = null,
      items = [],
    } = body;

    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'BILL_ID_REQUIRED', message: 'Bill ID is required to finalize transaction.' } },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: { code: 'CUSTOMER_ID_REQUIRED', message: 'Customer ID is required to finalize transaction.' } },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await customerRepository.findCustomerById(customerId);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'The specified customer could not be found.' } },
        { status: 404 }
      );
    }

    // Call authoritative business engine with worker ID
    const transaction = await finalizePhysicalPurchaseAtomic({
      billId,
      customerId,
      workerId: worker.id,
      paymentMethod: paymentMethod.toUpperCase(),
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      items,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...transaction,
        worker: {
          id: worker.id,
          name: worker.name,
        },
      },
      message: 'In-store transaction finalized successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    let status = 500;
    if (error.code === 'UNAUTHORIZED') status = 401;
    else if (error.code === 'FORBIDDEN') status = 403;
    else if (error.code === 'BILL_NOT_FOUND') status = 404;
    else if (error.code === 'BILL_ALREADY_PROCESSED') status = 409;
    else if (error.code === 'BILL_NUMBER_MISSING' || error.code === 'INVALID_PAYMENT_SIGNATURE' || error.code === 'PAYMENT_REQUIRED') status = 400;

    console.error('[API ERROR] POST /api/v1/worker/transactions/commit:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'TRANSACTION_COMMIT_FAILED',
          message: error.message || 'Unable to finalize transaction.',
        },
      },
      { status }
    );
  }
}
