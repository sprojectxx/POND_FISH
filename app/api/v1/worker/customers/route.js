/**
 * Worker Customer Search API Endpoint
 * GET /api/v1/worker/customers
 * Traceability: PondFish Worker Portal Specification (WP-06)
 * Enables store workers to look up customers by phone or name for in-counter assisted sales.
 * Enforces worker authentication, active worker verification, and sanitizes sensitive fields.
 */

import { NextResponse } from 'next/server';
const { verifyWorkerSessionAsync, extractWorkerToken } = require('../../../../../lib/engines/worker');
const customerRepository = require('../../../../../lib/db/repositories/customerRepository');

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

export async function GET(request) {
  try {
    const worker = await authenticateWorkerRequest(request);
    const effectiveWorkerStore = typeof worker?.storeId === 'string' ? worker.storeId.trim() : (typeof worker?.store_id === 'string' ? worker.store_id.trim() : '');
    if (!effectiveWorkerStore) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STORE_MISMATCH',
            message: 'Forbidden: Worker lacks a valid authoritative store assignment.',
          },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || searchParams.get('q') || searchParams.get('phone') || '';
    const trimmed = search.trim();

    // Prevent unauthorized mass customer enumeration
    if (!trimmed || trimmed.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Please provide at least 2 characters to search by customer name or mobile number.',
        timestamp: new Date().toISOString(),
      });
    }

    const customers = await customerRepository.listAdminCustomers({ search: trimmed });

    // Sanitize output for worker tablet display
    const sanitized = (customers || []).slice(0, 25).map((c) => ({
      id: c.id,
      name: c.name || 'Valued Customer',
      mobile_number: c.mobile_number,
      area: c.area || 'Store Counter',
      subscription: {
        active: c.subscription_status === 'ACTIVE',
        subscriptionId: c.subscription_id || null,
        planName: c.subscription_plan_name || null,
        creditBalance: parseFloat(c.credit_balance || 0),
      },
      bookingsCount: c.bookings_count || 0,
      transactionsCount: c.transactions_count || 0,
    }));

    return NextResponse.json({
      success: true,
      data: sanitized,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status || (error.code === 'FORBIDDEN' || error.code === 'WORKER_ACCOUNT_DISABLED' ? 403 : error.code === 'UNAUTHORIZED' ? 401 : 500);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'CUSTOMER_SEARCH_FAILED',
          message: error.message || 'Unable to complete customer search. Please try again.',
        },
      },
      { status }
    );
  }
}
