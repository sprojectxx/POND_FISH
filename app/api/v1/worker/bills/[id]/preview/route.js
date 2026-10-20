/**
 * Worker Physical Counter Bill Calculation Preview Endpoint
 * POST /api/v1/worker/bills/[id]/preview
 * Traceability: PondFish Worker Portal Spec (WP-08, WP-09) & Master PRD v2 (Section 9.3)
 * 
 * Computes server-authoritative preview of subscription allowance, monetary credit applied,
 * extra payable amount, and gateway fees for the worker counter checkout.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionToken } = require('../../../../../../../lib/engines/worker');
const workerRepository = require('../../../../../../../lib/db/repositories/workerRepository');
const billRepository = require('../../../../../../../lib/db/repositories/billRepository');
const fishRepository = require('../../../../../../../lib/db/repositories/fishRepository');
const { calculateSubscriptionCoverage } = require('../../../../../../../lib/engines/customer-subscription');
const { calculatePaymentFees } = require('../../../../../../../lib/engines/payment');

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

export async function POST(request, { params }) {
  try {
    await authenticateWorkerRequest(request);
    const billId = params?.id;
    const body = await request.json().catch(() => ({}));
    const items = body?.items || [];

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

    if (bill.status === 'PROCESSED') {
      return NextResponse.json(
        { success: false, error: { code: 'BILL_ALREADY_PROCESSED', message: 'This bill has already been finalized.' } },
        { status: 409 }
      );
    }

    // Resolve fish items
    let resolvedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const fish = await fishRepository.getFishById(it.fishId || it.fish_id);
        if (fish) {
          const qty = parseFloat(it.quantityKg || it.quantity || 1.0);
          const unitPrice = parseFloat(fish.unit_price ?? fish.unitPrice ?? 0);
          resolvedItems.push({
            fishId: fish.id,
            fishName: fish.name,
            quantity: qty,
            quantityKg: qty,
            unitPrice,
            subtotal: parseFloat((qty * unitPrice).toFixed(2)),
          });
        }
      }
    }

    if (resolvedItems.length === 0) {
      const allFish = await fishRepository.getAllFish({ availabilityOnly: false });
      if (allFish.length > 0) {
        const sample = allFish[0];
        const samplePrice = parseFloat(sample.unit_price ?? sample.unitPrice ?? 0);
        resolvedItems.push({
          fishId: sample.id,
          fishName: sample.name,
          quantity: 1.0,
          quantityKg: 1.0,
          unitPrice: samplePrice,
          subtotal: samplePrice,
        });
      }
    }

    const grossTotal = resolvedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);

    // Calculate subscription coverage
    const subResult = await calculateSubscriptionCoverage({
      customerId: bill.customer_id,
      cartItems: resolvedItems,
    });

    const extraPayable = subResult.extraPayableAmount || 0;
    const fees = calculatePaymentFees(extraPayable);

    return NextResponse.json({
      success: true,
      data: {
        billId: bill.id,
        customerId: bill.customer_id,
        items: resolvedItems,
        grossTotal: parseFloat(grossTotal.toFixed(2)),
        subscriptionCoverage: subResult,
        fees,
        finalPayable: fees.finalPayable,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || (error.code === 'FORBIDDEN' ? 403 : error.code === 'UNAUTHORIZED' ? 401 : 500);
    console.error('[API ERROR] POST /api/v1/worker/bills/[id]/preview:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PREVIEW_CALCULATION_FAILED',
          message: error.message || 'Unable to calculate checkout preview.',
        },
      },
      { status }
    );
  }
}
