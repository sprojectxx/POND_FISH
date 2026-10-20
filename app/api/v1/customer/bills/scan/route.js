/**
 * Customer Bill Scan API Endpoint
 * POST /api/v1/customer/bills/scan
 * Traceability: PondFish API Specification v1 (Sections 18, 19), Master PRD v2 (Section 8)
 * 
 * Accepts multipart/form-data or JSON with base64 image representation of a physical store receipt.
 * Runs Tesseract.js OCR extraction, matches against fish catalog, and logs to ai_extraction_logs.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { processBillImage } = require('../../../../../../lib/engines/bill-ocr');

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

export async function POST(request) {
  try {
    const session = authenticateRequest(request);
    const contentType = request.headers.get('content-type') || '';

    let imageInput = null;
    let imageUrl = '/uploads/bills/receipt.jpg';
    let clientDryRunBody = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('bill_image') || formData.get('image');
      clientDryRunBody = formData.get('dry_run') === 'true';
      if (!file) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'IMAGE_REQUIRED',
              message: 'Please capture or upload your bill image.',
            },
          },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      imageInput = buffer;
      imageUrl = `/uploads/bills/${Date.now()}-${file.name || 'bill.jpg'}`;
    } else {
      // JSON body (e.g. { image_base64, image_url, raw_text, dry_run })
      const body = await request.json().catch(() => ({}));
      clientDryRunBody = Boolean(body.dry_run);
      if (body.image_base64) {
        // Strip data prefix if present
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
              message: 'Please capture or upload your bill image.',
            },
          },
          { status: 400 }
        );
      }
    }

    // Explicit dry-run check: client flag alone is never trusted.
    // Must be non-production AND explicitly enabled via server environment.
    const url = new URL(request.url);
    const clientDryRunParam = url.searchParams.get('dry_run') === 'true';
    const clientDryRunHeader = request.headers.get('x-scan-dry-run') === 'true';
    const clientWantsDryRun = clientDryRunParam || clientDryRunHeader || clientDryRunBody;

    if (clientWantsDryRun) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DRY_RUN_FORBIDDEN',
              message: 'Scan dry-run is strictly prohibited in production environments.',
            },
          },
          { status: 403 }
        );
      }
      if (process.env.ENABLE_DEV_SCAN_DRY_RUN !== 'true') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DRY_RUN_DISABLED',
              message: 'Scan dry-run is disabled by server configuration.',
            },
          },
          { status: 403 }
        );
      }
    }

    const dryRun = Boolean(clientWantsDryRun && process.env.ENABLE_DEV_SCAN_DRY_RUN === 'true' && process.env.NODE_ENV !== 'production');

    const customerId = session.customerId || session.id || session.sub;

    const extractionResult = await processBillImage({
      customerId,
      imageInput,
      imageUrl,
      dryRun,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          scan_id: extractionResult.scanId,
          bill_id: extractionResult.billId,
          bill_number: extractionResult.billNumber,
          bill_number_missing: extractionResult.billNumberMissing,
          confidence_score: extractionResult.confidenceScore,
          status: extractionResult.status,
          total: extractionResult.total,
          items: extractionResult.items,
          warnings: extractionResult.warnings,
          created_at: extractionResult.createdAt,
          dry_run: Boolean(extractionResult.dryRun),
        },
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[CUSTOMER BILL SCAN ERROR]', error);
    const status = error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'SERVER_ERROR',
          message: error.message || 'Unable to scan bill image.',
        },
      },
      { status }
    );
  }
}
