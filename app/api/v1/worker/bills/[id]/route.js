/**
 * Worker Bill Details & Correction Endpoint
 * GET /api/v1/worker/bills/[id]
 * PATCH /api/v1/worker/bills/[id]
 * Traceability: PondFish Worker Portal Spec (WP-08) & Master PRD v2 (Section 8.2, 8.3)
 * 
 * Retrieves OCR extraction details, matched items, and allows manual Bill Number fallback.
 * Strictly enforces worker authentication and prevents modifying already processed bills.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken } = require('../../../../../../lib/engines/worker');
const workerRepository = require('../../../../../../lib/db/repositories/workerRepository');
const billRepository = require('../../../../../../lib/db/repositories/billRepository');
const customerRepository = require('../../../../../../lib/db/repositories/customerRepository');
const fishRepository = require('../../../../../../lib/db/repositories/fishRepository');
const { parseBillItems } = require('../../../../../../lib/engines/bill-ocr');
const auditEngine = require('../../../../../../lib/engines/audit');

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
    await authenticateWorkerRequest(request);
    const billId = params?.id;

    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BILL_ID', message: 'Bill ID is required.' } },
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

    // Retrieve catalog fish and parse line items from extracted text
    const catalogFish = await fishRepository.getAllFish({ availabilityOnly: false });
    const parsed = parseBillItems(bill.extracted_text || '', catalogFish);

    // Fetch customer details and subscription status
    let customerInfo = null;
    if (bill.customer_id) {
      const fullProfile = await customerRepository.getCustomerDetailedProfile(bill.customer_id);
      if (fullProfile) {
        customerInfo = {
          id: fullProfile.customer.id,
          name: fullProfile.customer.name,
          mobile_number: fullProfile.customer.mobile_number,
          area: fullProfile.customer.area,
          activeSubscription: fullProfile.activeSubscription ? {
            id: fullProfile.activeSubscription.id,
            planName: fullProfile.activeSubscription.plan_name,
            creditBalance: parseFloat(fullProfile.activeSubscription.credit_balance || 0),
            weeklyLimitKg: parseFloat(fullProfile.activeSubscription.weekly_qty_limit_kg || 0),
            weeklyQtyUsed: parseFloat(fullProfile.activeSubscription.weekly_qty_used || 0),
          } : null,
        };
      }
    }

    const effectiveBillNumber = bill.manual_bill_id || bill.bill_number;
    const isAlreadyProcessed = bill.status === 'PROCESSED';

    return NextResponse.json({
      success: true,
      data: {
        id: bill.id,
        customerId: bill.customer_id,
        customerName: bill.customer_name || customerInfo?.name || 'Counter Customer',
        customerPhone: bill.customer_phone || customerInfo?.mobile_number || '',
        customer: customerInfo,
        billNumber: effectiveBillNumber,
        originalBillNumber: bill.bill_number,
        manualBillId: bill.manual_bill_id,
        imageUrl: bill.image_url,
        extractedText: bill.extracted_text,
        aiConfidenceScore: bill.ai_confidence_score,
        status: bill.status,
        isAlreadyProcessed,
        items: parsed.items || [],
        total: parsed.total || 0,
        warnings: parsed.warnings || [],
        createdAt: bill.created_at,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || (error.code === 'FORBIDDEN' ? 403 : error.code === 'UNAUTHORIZED' ? 401 : 500);
    console.error('[API ERROR] GET /api/v1/worker/bills/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BILL_FETCH_FAILED',
          message: error.message || 'Unable to retrieve bill details.',
        },
      },
      { status }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const worker = await authenticateWorkerRequest(request);
    const billId = params?.id;
    const body = await request.json().catch(() => ({}));
    const billNumber = body?.billNumber || body?.bill_number;

    if (!billId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BILL_ID', message: 'Bill ID is required.' } },
        { status: 400 }
      );
    }

    if (!billNumber || typeof billNumber !== 'string' || !billNumber.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'BILL_NUMBER_REQUIRED', message: 'Please enter a valid Bill ID.' } },
        { status: 400 }
      );
    }

    const cleanBillNumber = billNumber.trim().toUpperCase();

    // Format validation: 3-32 characters alphanumeric
    if (!/^[A-Z0-9#-]{3,32}$/.test(cleanBillNumber)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FORMAT', message: 'Invalid Bill ID format. Please check the printed scale slip.' } },
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

    if (bill.status === 'PROCESSED') {
      return NextResponse.json(
        { success: false, error: { code: 'BILL_ALREADY_PROCESSED', message: 'This bill has already been finalized.' } },
        { status: 409 }
      );
    }

    // Duplicate bill check under database lookup
    const isDuplicate = await billRepository.isBillNumberAlreadyProcessed(cleanBillNumber, billId);
    if (isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_BILL_NUMBER',
            message: 'This bill number has already been processed in another transaction.',
          },
        },
        { status: 409 }
      );
    }

    const updated = await billRepository.updateBillNumber(null, billId, cleanBillNumber, true);

    try {
      await auditEngine.recordAuditLog({
        actorType: 'WORKER',
        actorId: worker.id,
        action: 'BILL_NUMBER_MANUAL_OVERRIDE',
        entityType: 'BILL',
        entityId: billId,
        payload: {
          workerId: worker.id,
          previousBillNumber: bill.bill_number,
          newBillNumber: cleanBillNumber,
          customerId: bill.customer_id,
        },
      });
    } catch (auditErr) {
      console.warn('[MANUAL BILL OVERRIDE AUDIT WARNING]', auditErr.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        billNumber: updated.bill_number,
        manualBillId: updated.manual_bill_id,
        status: updated.status,
      },
      message: 'Bill ID updated successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || (error.code === 'FORBIDDEN' ? 403 : error.code === 'UNAUTHORIZED' ? 401 : 500);
    console.error('[API ERROR] PATCH /api/v1/worker/bills/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BILL_UPDATE_FAILED',
          message: error.message || 'Unable to update bill number.',
        },
      },
      { status }
    );
  }
}
