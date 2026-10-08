/**
 * Worker Physical Store Bill Slip Upload & OCR Extraction Endpoint
 * POST /api/v1/worker/bills/scan
 * Traceability: PondFish Worker Portal Spec (WP-07) & Master PRD v2 (Section 7, 8)
 * 
 * Accepts multipart/form-data or JSON payload from worker tablet camera/upload.
 * Runs Tesseract OCR extraction via existing bill-ocr.js engine and associates the bill
 * with the selected customer and authenticated worker.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken } = require('../../../../../../lib/engines/worker');
const workerRepository = require('../../../../../../lib/db/repositories/workerRepository');
const customerRepository = require('../../../../../../lib/db/repositories/customerRepository');
const { processBillImage } = require('../../../../../../lib/engines/bill-ocr');
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

  // Enforce active status in database
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
    const contentType = request.headers.get('content-type') || '';

    let customerId = null;
    let imageInput = null;
    let imageUrl = '/uploads/bills/worker-counter-receipt.jpg';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      customerId = formData.get('customerId') || formData.get('customer_id');
      const file = formData.get('bill_image') || formData.get('image');

      if (!file) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'IMAGE_REQUIRED',
              message: 'Please capture or upload the customer bill image.',
            },
          },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      imageInput = buffer;
      imageUrl = `/uploads/bills/worker-${Date.now()}-${file.name || 'bill.jpg'}`;
    } else {
      // JSON body (e.g. { customerId, image_base64, raw_text, image_url })
      const body = await request.json().catch(() => ({}));
      customerId = body.customerId || body.customer_id;

      if (body.image_base64) {
        const base64Data = body.image_base64.replace(/^data:image\/\w+;base64,/, '');
        imageInput = Buffer.from(base64Data, 'base64');
      } else if (body.raw_text) {
        // Direct text simulation for testing
        imageInput = body.raw_text;
      } else if (body.image_url) {
        imageInput = body.image_url;
        imageUrl = body.image_url;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'IMAGE_REQUIRED',
              message: 'Please capture or upload the customer bill image.',
            },
          },
          { status: 400 }
        );
      }
    }

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CUSTOMER_REQUIRED',
            message: 'Please select a customer before scanning the bill.',
          },
        },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await customerRepository.findCustomerById(customerId);
    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'The selected customer could not be found.',
          },
        },
        { status: 404 }
      );
    }

    // Process bill through existing Tesseract OCR engine
    const extractionResult = await processBillImage({
      customerId: customer.id,
      imageInput,
      imageUrl,
    });

    // Record worker action in immutable audit logs
    try {
      await auditEngine.recordAuditLog({
        actorType: 'WORKER',
        actorId: worker.id,
        action: 'BILL_SCANNED_BY_WORKER',
        entityType: 'BILL',
        entityId: extractionResult.billId,
        payload: {
          workerId: worker.id,
          workerName: worker.name,
          customerId: customer.id,
          customerName: customer.name,
          billNumber: extractionResult.billNumber,
          matchedItemsCount: extractionResult.items?.length || 0,
          confidenceScore: extractionResult.confidenceScore,
          status: extractionResult.status,
        },
      });
    } catch (auditErr) {
      console.warn('[WORKER BILL SCAN AUDIT WARNING]', auditErr.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...extractionResult,
        workerId: worker.id,
        customerName: customer.name,
        customerPhone: customer.mobile_number,
      },
      message: 'Bill processed successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || (error.code === 'FORBIDDEN' ? 403 : error.code === 'UNAUTHORIZED' ? 401 : 500);
    console.error('[API ERROR] POST /api/v1/worker/bills/scan:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'BILL_SCAN_FAILED',
          message: error.message || 'Unable to scan bill at this time. Please try again.',
        },
      },
      { status }
    );
  }
}
