/**
 * Customer Cart Items Endpoint
 * POST /api/v1/customer/cart/items
 * Traceability: PondFish API Specification (Section 13) & Customer Portal PRD (CP-05)
 * Strict business validation: Only fish explicitly enabled for online booking can enter the cart.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../lib/engines/customer');
const { addItem } = require('../../../../../../lib/engines/cart');

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

export async function POST(request) {
  try {
    const session = authenticateRequest(request);
    const body = await request.json().catch(() => ({}));

    const fishId = body.fish_id || body.fishId;
    const quantity = body.quantity !== undefined ? body.quantity : 1;

    const cart = await addItem({
      customerId: session.customerId,
      fishId,
      quantity,
    });

    return NextResponse.json(
      {
        success: true,
        data: cart,
        message: 'Item added to cart successfully.',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid customer authentication session is required to add items to cart.',
          },
        },
        { status: 401 }
      );
    }

    if (error.code === 'INVALID_FISH_ID') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FISH_ID',
            message: 'Provided fish identifier is not a valid UUID format.',
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'INVALID_QUANTITY') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_QUANTITY',
            message: 'Quantity must be a positive number greater than zero.',
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'QUANTITY_EXCEEDS_LIMIT') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'QUANTITY_EXCEEDS_LIMIT',
            message: 'Quantity cannot exceed 100 kg per item.',
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'FISH_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FISH_NOT_FOUND',
            message: 'Requested fish does not exist in the catalogue.',
          },
        },
        { status: 404 }
      );
    }

    if (error.code === 'FISH_UNAVAILABLE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FISH_UNAVAILABLE',
            message: 'This fish is currently out of stock.',
          },
        },
        { status: 422 }
      );
    }

    if (error.code === 'FISH_NOT_ONLINE_BOOKABLE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FISH_NOT_ONLINE_BOOKABLE',
            message: 'Online booking is unavailable for this fish. Physical in-store purchase only.',
          },
        },
        { status: 422 }
      );
    }

    console.error('[API ERROR] POST /api/v1/customer/cart/items:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ADD_CART_ITEM_FAILED',
          message: 'Unable to add item to cart at this time.',
        },
      },
      { status: 500 }
    );
  }
}
