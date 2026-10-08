/**
 * Admin Transaction Detail API
 * GET /api/v1/admin/transactions/[id]
 * Traceability: ADMIN-13 (Sections 108–116)
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync } = require('../../../../../../lib/auth/admin-auth');
const transactionEngine = require('../../../../../../lib/engines/transaction');

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await authenticateAdminAsync(request);
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;

    const transaction = await transactionEngine.getAdminTransactionDetail(id);

    return NextResponse.json({
      success: true,
      transaction,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'TRANSACTION_DETAIL_ERROR',
          message: error.message,
        },
      },
      { status: error.status || (error.code === 'TRANSACTION_NOT_FOUND' ? 404 : 500) }
    );
  }
}
