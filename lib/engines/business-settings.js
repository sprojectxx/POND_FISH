/**
 * Engine 26: Global Business Settings & Configuration Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 26),
 * Page-by-Page UI Specification Admin Portal (AP-17, Sections 148–151),
 * Database ERD Specification (Section 32)
 */

const pool = require('../db/pool');
const auditEngine = require('./audit');

const ALLOWED_SETTING_KEYS = [
  'store_info',
  'store_destination',
  'truck_info',
  'operational_rules',
];

/**
 * Default fallback values when settings haven't been seeded yet
 */
function getDefaultSettings() {
  const latStr = process.env.PONDFISH_STORE_LATITUDE;
  const lonStr = process.env.PONDFISH_STORE_LONGITUDE;
  const radiusStr = process.env.PONDFISH_GEOFENCE_RADIUS_METERS;
  const minutesStr = process.env.PONDFISH_POST_ARRIVAL_TRACKING_MINUTES;

  return {
    store_info: {
      name: process.env.PONDFISH_STORE_NAME || 'PondFish Main Store',
      address: process.env.PONDFISH_STORE_ADDRESS || '123 Fresh Lake Road, Water Town, AP',
      phone: '+91 9876543210',
      openingTime: '06:00 AM',
      closingTime: '09:00 PM',
    },
    store_destination: {
      name: process.env.PONDFISH_STORE_NAME || 'PondFish Main Store',
      address: process.env.PONDFISH_STORE_ADDRESS || '123 Fresh Lake Road, Water Town, AP',
      latitude: latStr ? parseFloat(latStr) : null,
      longitude: lonStr ? parseFloat(lonStr) : null,
      geofenceRadiusMeters: radiusStr ? parseInt(radiusStr, 10) : 500,
      postArrivalTrackingMinutes: minutesStr ? parseInt(minutesStr, 10) : 45,
    },
    truck_info: {
      truckNumber: 'AP-39-TF-1001',
      driverName: 'Ramesh Kumar',
      coverageArea: 'Water Town & Surrounding 15km',
    },
    operational_rules: {
      bookingExpiryHours: 48,
      defaultGeofenceRadiusMeters: 500,
    },
  };
}

/**
 * Fetch all business settings
 */
async function getAllSettings() {
  const res = await pool.query('SELECT key, value, updated_at FROM settings;');
  const defaults = getDefaultSettings();
  const settingsMap = { ...defaults };

  for (const row of res.rows) {
    try {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (ALLOWED_SETTING_KEYS.includes(row.key)) {
        settingsMap[row.key] = {
          ...defaults[row.key],
          ...parsed,
          updated_at: row.updated_at,
        };
      }
    } catch (e) {
      console.warn(`[SettingsEngine] Failed to parse setting ${row.key}:`, e.message);
    }
  }

  return settingsMap;
}

/**
 * Fetch a single setting by key
 */
async function getSetting(key) {
  if (!ALLOWED_SETTING_KEYS.includes(key)) {
    throw new Error(`Invalid setting key: ${key}`);
  }
  const settings = await getAllSettings();
  return settings[key];
}

/**
 * Validate setting values before saving
 */
function validateSettingValue(key, value) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Setting payload for ${key} must be an object`);
  }

  switch (key) {
    case 'store_info': {
      if (!value.name || typeof value.name !== 'string' || value.name.trim() === '') {
        throw new Error('Store name is required');
      }
      if (!value.phone || typeof value.phone !== 'string' || value.phone.trim().length < 8) {
        throw new Error('Valid contact number is required');
      }
      if (!value.openingTime || typeof value.openingTime !== 'string') {
        throw new Error('Opening time is required');
      }
      if (!value.closingTime || typeof value.closingTime !== 'string') {
        throw new Error('Closing time is required');
      }
      break;
    }
    case 'store_destination': {
      if (!value.name || typeof value.name !== 'string' || value.name.trim() === '') {
        throw new Error('Destination name is required');
      }
      const lat = parseFloat(value.latitude);
      const lng = parseFloat(value.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('Valid latitude between -90 and 90 is required');
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new Error('Valid longitude between -180 and 180 is required');
      }
      if (value.geofenceRadiusMeters !== undefined) {
        const radius = parseInt(value.geofenceRadiusMeters, 10);
        if (isNaN(radius) || radius < 50 || radius > 10000) {
          throw new Error('Geofence radius must be between 50m and 10000m');
        }
      }
      if (value.postArrivalTrackingMinutes !== undefined) {
        const mins = parseInt(value.postArrivalTrackingMinutes, 10);
        if (isNaN(mins) || mins < 30 || mins > 60) {
          throw new Error('Post-arrival tracking window must be between 30 and 60 minutes');
        }
      }
      break;
    }
    case 'truck_info': {
      if (!value.truckNumber || typeof value.truckNumber !== 'string' || value.truckNumber.trim() === '') {
        throw new Error('Truck number is required');
      }
      if (!value.driverName || typeof value.driverName !== 'string' || value.driverName.trim() === '') {
        throw new Error('Driver name is required');
      }
      break;
    }
    case 'operational_rules': {
      if (value.bookingExpiryHours !== undefined) {
        const hours = parseInt(value.bookingExpiryHours, 10);
        if (isNaN(hours) || hours < 1 || hours > 168) {
          throw new Error('Booking expiry hours must be between 1 and 168');
        }
      }
      break;
    }
    default:
      throw new Error(`Unsupported setting key: ${key}`);
  }
}

/**
 * Update a business setting with audit trail logging
 */
async function updateSetting(key, value, { actorId = 'admin-system', actorType = 'ADMIN', reason = 'Admin settings update' } = {}) {
  if (!ALLOWED_SETTING_KEYS.includes(key)) {
    const err = new Error(`INVALID_SETTING_KEY: ${key}`);
    err.code = 'INVALID_SETTING_KEY';
    throw err;
  }

  validateSettingValue(key, value);

  // 1. Get old value for audit recording
  const currentSettings = await getAllSettings();
  const oldValue = currentSettings[key] || null;

  // 2. Persist update in settings table
  const stringifiedValue = JSON.stringify(value);
  const updateRes = await pool.query(
    'UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *;',
    [stringifiedValue, key]
  );

  let updatedRow;
  if (updateRes.rows.length > 0) {
    updatedRow = updateRes.rows[0];
  } else {
    const insertRes = await pool.query(
      'INSERT INTO settings (id, key, value, updated_at) VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING *;',
      [key, stringifiedValue]
    );
    updatedRow = insertRes.rows[0];
  }

  // 2b. Synchronize active runtime engine caches immediately
  if (key === 'store_destination' || key === 'store_info') {
    try {
      const geofenceEngine = require('./geofence');
      if (geofenceEngine && geofenceEngine.loadStoreConfigFromDb) {
        await geofenceEngine.loadStoreConfigFromDb();
      }
    } catch (syncErr) {
      console.warn('[SettingsEngine] Geofence cache sync warning:', syncErr.message);
    }
  }

  // 3. Write immutable audit log entry
  try {
    await auditEngine.recordAuditLog({
      actorType,
      actorId,
      action: 'UPDATE_BUSINESS_SETTING',
      entityType: 'SETTINGS',
      entityId: key,
      payload: {
        key,
        old_value: oldValue,
        new_value: value,
        reason,
      },
    });
  } catch (auditErr) {
    console.error('[SettingsEngine] Failed to record audit log:', auditErr.message);
  }

  return {
    key: updatedRow.key,
    value: JSON.parse(updatedRow.value),
    updated_at: updatedRow.updated_at,
  };
}

module.exports = {
  name: 'BusinessSettingsEngine',
  ALLOWED_SETTING_KEYS,
  getAllSettings,
  getSetting,
  updateSetting,
};
