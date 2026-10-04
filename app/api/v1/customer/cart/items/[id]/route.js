/**
 * Customer Cart Item by ID Endpoint
 * PATCH /api/v1/customer/cart/items/[id]
 * DELETE /api/v1/customer/cart/items/[id]
 * Traceability: PondFish API Specification (Section 13) & Customer Portal PRD (CP-05)
 * Supports quantity adjustment (kg) and item removal.
 */

import { NextResponse } from 'next/server';
const { verifySessionToken } = require('../../../../../../../lib/engines/customer');
const { updateItemQuantity, removeItem } = require('../../../../../../../lib/engines/cart');

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

export async function PATCH(request, { params }) {
  try {
    const session = authenticateRequest(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body.quantity === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_QUANTITY',
            message: 'Quantity field is required.',
          },
        },
        { status: 400 }
      );
    }

    const cart = await updateItemQuantity({
      customerId: session.customerId,
      fishId: id,
      quantity: body.quantity,
    });

    return NextResponse.json({
      success: true,
      data: cart,
      message: 'Cart item updated successfully.',
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
            message: 'Quantity must be a valid positive number.',
          },
        },
        { status: 400 }
      );
    }

    if (error.code === 'CART_ITEM_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CART_ITEM_NOT_FOUND',
            message: 'Item not found in customer cart.',
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
            message: 'Online booking is unavailable for this fish.',
          },
        },
        { status: 422 }
      );
    }

    console.error('[API ERROR] PATCH /api/v1/customer/cart/items/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_CART_ITEM_FAILED',
          message: 'Unable to update cart item at this time.',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = authenticateRequest(request);
    const { id } = await params;

    const cart = await removeItem({
      customerId: session.customerId,
      fishId: id,
    });

    return NextResponse.json({
      success: true,
      data: cart,
      message: 'Item removed from cart.',
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

    console.error('[API ERROR] DELETE /api/v1/customer/cart/items/[id]:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REMOVE_CART_ITEM_FAILED',
          message: 'Unable to remove cart item at this time.',
        },
      },
      { status: 500 }
    );
  }
}
