/**
 * Worker Bill Confirmation & Human Review Endpoint
 * POST /api/v1/worker/bills/[id]/confirm
 * Traceability: PondFish Worker Portal Spec (WP-08) & Master PRD v2 (Section 8.4)
 * 
 * Enforces human review boundary: transitions bill status to CONFIRMED, records reviewing worker ID
 * and store ID in PostgreSQL, and verifies duplicate protection prior to checkout finalization.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionAsync, extractWorkerToken } = require('../../../../../../../lib/engines/worker');
const billRepository = require('../../../../../../../lib/db/repositories/billRepository');
const auditEngine = require('../../../../../../../lib/engines/audit');

export const dynamic = 'force-dynamic';

async function authenticateWorkerRequest(request) {
  const token = extractWorkerToken(request);
  if (!token) {
    const err = new Error('A valid worker authentication token is required.');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  const session = await verifyWorkerSessionAsync(token);
  return session.worker;
}

export async function POST(request, { params }) {
  try {
    const worker = await authenticateWorkerRequest(request);
    const billId = params?.id;

    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Bill ID is required.' } },
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

    // Worker Store Scoping: Prevent workers from confirming bills from other stores
    if (bill.store_id && worker.storeId && bill.store_id !== worker.storeId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STORE_MISMATCH',
            message: 'Unauthorized: This bill belongs to a different store.',
          },
        },
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

    if (bill.status === 'REJECTED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BILL_REJECTED',
            message: 'This bill was rejected due to unreadable quality. Please recapture the photo or enter details manually.',
          },
        },
        { status: 400 }
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

    // Persist human review confirmation in PostgreSQL
    const updatedBill = await billRepository.confirmBill(null, bill.id, {
      status: 'CONFIRMED',
      workerId: worker.id,
      storeId: worker.storeId || bill.store_id || null,
    });

    try {
      await auditEngine.recordAuditLog({
        actorType: 'WORKER',
        actorId: worker.id,
        action: 'BILL_CONFIRMED_BY_WORKER',
        entityType: 'BILL',
        entityId: bill.id,
        payload: {
          workerId: worker.id,
          workerName: worker.name,
          storeId: worker.storeId || bill.store_id || null,
          billNumber: effectiveBillNumber,
          customerId: bill.customer_id,
        },
      });
    } catch (auditErr) {
      console.warn('[WORKER BILL CONFIRM AUDIT WARNING]', auditErr.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        bill_id: updatedBill.id,
        bill_number: effectiveBillNumber,
        status: updatedBill.status || 'CONFIRMED',
        worker_id: worker.id,
        store_id: updatedBill.store_id,
        message: 'Bill verified and confirmed for counter checkout.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || (error.code === 'FORBIDDEN' ? 403 : error.code === 'UNAUTHORIZED' ? 401 : 500);
    console.error('[API ERROR] POST /api/v1/worker/bills/[id]/confirm:', error.message);
    return NextResponse.json(
      { success: false, error: { code: error.code || 'CONFIRM_FAILED', message: error.message } },
      { status }
    );
  }
}
