/**
 * Protected Scheduled Broadcast Background Processor Endpoint
 * POST /api/v1/admin/notifications/process-scheduled
 * Traceability: Admin Portal Specification Sections 132, 135
 * Atomically claims and dispatches due scheduled broadcasts (scheduled_at <= NOW()).
 * Protected by CRON_SECRET or authenticated ADMIN session.
 */

import { NextResponse } from 'next/server';
const { authenticateAdminAsync, timingSafeEqualStrings } = require('../../../../../../lib/auth/admin-auth');
const notificationsEngine = require('../../../../../../lib/engines/notifications');

export const dynamic = 'force-dynamic';

function getSystemCronSecret() {
  const secret = process.env.INTERNAL_SYSTEM_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return null; // Fail closed in production if no secret is configured
    }
    return 'pondfish-internal-secret-2026';
  }
  return secret;
}

function authenticateSchedulerRequest(request) {
  const systemSecret = getSystemCronSecret();
  if (!systemSecret) return null;

  // 1. Check internal system cron header
  const internalHeader = request.headers.get('x-internal-secret') || '';
  if (internalHeader && timingSafeEqualStrings(internalHeader, systemSecret)) {
    return { isCron: true, actorId: 'system-cron' };
  }

  // 2. Check Bearer token matching cron secret
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (timingSafeEqualStrings(token, systemSecret)) {
      return { isCron: true, actorId: 'system-cron' };
    }
  }

  return null;
}

export async function POST(request) {
  try {
    let authContext = authenticateSchedulerRequest(request);

    // If not cron secret, fall back to admin session check
    if (!authContext) {
      try {
        const admin = await authenticateAdminAsync(request);
        authContext = { isCron: false, actorId: admin.id || 'admin-system' };
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or missing CRON_SECRET or administrative session.',
            },
          },
          { status: 401 }
        );
      }
    }

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const outcome = await notificationsEngine.processDueScheduledBroadcasts({
      actorId: authContext.actorId,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${outcome.processedCount} due scheduled broadcast(s).`,
      processedCount: outcome.processedCount,
      results: outcome.results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'PROCESS_SCHEDULED_ERROR',
          message: error.message,
        },
      },
      { status: 500 }
    );
  }
}
