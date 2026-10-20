/**
 * Customer Cart Root Endpoint
 * GET /api/v1/customer/cart
 * DELETE /api/v1/customer/cart
 * Traceability: PondFish API Specification (Section 13) & Core Engines Spec (Section 13)
 * Authoritative cart retrieval with live pricing, discount, and online-booking eligibility revalidation.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../lib/engines/customer');
const { getCart, clearCart } = require('../../../../../lib/engines/cart');

export const dynamic = 'force-dynamic';

function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('MISSING_BEARER_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const token = authHeader.substring(7).trim();
  try {
    return verifySessionToken(token);
  } catch {
    const err = new Error('INVALID_SESSION_TOKEN');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
}

export async function GET(request) {
  try {
    const session = authenticateRequest(request);
    const cart = await getCart(session.customerId);

    return NextResponse.json({
      success: true,
      data: cart,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to view cart.',
          },
        },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/customer/cart:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CART_FETCH_FAILED',
          message: 'Unable to retrieve customer cart at this time.',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = authenticateRequest(request);
    const cart = await clearCart(session.customerId);

    return NextResponse.json({
      success: true,
      data: cart,
      message: 'Cart cleared successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required.',
          },
        },
        { status: 401 }
      );
    }

    console.error('[API ERROR] DELETE /api/v1/customer/cart:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CART_CLEAR_FAILED',
          message: 'Unable to clear customer cart at this time.',
        },
      },
      { status: 500 }
    );
  }
}
