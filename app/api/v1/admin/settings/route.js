/**
 * Admin Business Settings API Endpoint
 * GET /api/v1/admin/settings
 * PATCH /api/v1/admin/settings
 * Traceability: AP-17 — Business Settings Specification
 */

import { NextResponse } from 'next/server';
const { authenticateAdmin } = require('../../../../../lib/auth/admin-auth');
const businessSettingsEngine = require('../../../../../lib/engines/business-settings');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    authenticateAdmin(request);

    const settings = await businessSettingsEngine.getAllSettings();

    return NextResponse.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    console.error('[API ERROR] GET /api/v1/admin/settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_SETTINGS_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const admin = authenticateAdmin(request);

    const body = await request.json().catch(() => ({}));
    const { key, value, reason, confirmed } = body;

    if (!key || !value) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Setting key and value are required.' } },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: { code: 'AUDIT_REASON_REQUIRED', message: 'A descriptive audit reason (at least 5 characters) is required for business settings changes.' } },
        { status: 400 }
      );
    }

    if (key === 'store_destination' && confirmed !== true) {
      return NextResponse.json(
        { success: false, error: { code: 'ELEVATED_CONFIRMATION_REQUIRED', message: 'Modifying store destination and geofence coordinates requires elevated server-side confirmation.' } },
        { status: 400 }
      );
    }

    const updated = await businessSettingsEngine.updateSetting(key, value, {
      actorId: admin.id,
      actorType: 'ADMIN',
      reason: reason.trim(),
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Setting ${key} successfully updated.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } },
        { status: 401 }
      );
    }

    if (error.code === 'INVALID_SETTING_KEY' || error.message.includes('required') || error.message.includes('must be')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: error.message } },
        { status: 400 }
      );
    }

    console.error('[API ERROR] PATCH /api/v1/admin/settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_SETTINGS_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
