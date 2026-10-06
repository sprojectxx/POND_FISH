/**
 * Engine 18: Real-Time Dedicated Truck GPS Journey Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 18),
 * Master PRD v2 (Section 22), Integration Specification (Section 9)
 * 
 * Orchestrates journey lifecycle, start state changes, separate customer publication gate,
 * authentic GPS telemetry ingestion, staleness calculation (> 5 min),
 * geofence arrival detection, automatic post-arrival customer tracking closure,
 * and realtime WebSocket broadcast over 'gps:live'.
 */

const gpsRepository = require('../db/repositories/gpsRepository');
const geofenceEngine = require('./geofence');
const { onelapAdapter } = require('./onelap-adapter');
const domainEventsEngine = require('./domain-events');
const { broadcastGPS } = require('./realtime-broadcast');

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Validate GPS Coordinates
 */
function isValidCoordinate(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);
  return !isNaN(numLat) && !isNaN(numLon) && numLat >= -90 && numLat <= 90 && numLon >= -180 && numLon <= 180;
}

/**
 * Create a new GPS journey
 * @param {object} params
 * @returns {Promise<object>}
 */
async function createJourney({
  truckNumber,
  driverName,
  origin = null,
  destination = null,
  fishManifest = [],
}) {
  if (!truckNumber || !truckNumber.trim()) {
    const err = new Error('TRUCK_NUMBER_REQUIRED');
    err.code = 'VALIDATION_FAILED';
    err.status = 400;
    throw err;
  }

  if (!driverName || !driverName.trim()) {
    const err = new Error('DRIVER_NAME_REQUIRED');
    err.code = 'VALIDATION_FAILED';
    err.status = 400;
    throw err;
  }

  // Authoritative destination defaults to configured PondFish store
  const authoritativeDestination = destination || {
    name: geofenceEngine.DEFAULT_STORE_LOCATION.name,
    address: geofenceEngine.DEFAULT_STORE_LOCATION.address,
    latitude: geofenceEngine.DEFAULT_STORE_LOCATION.latitude,
    longitude: geofenceEngine.DEFAULT_STORE_LOCATION.longitude,
    geofenceRadiusMeters: geofenceEngine.DEFAULT_STORE_LOCATION.geofenceRadiusMeters,
  };

  const authoritativeOrigin = origin || {
    name: 'Fresh Catch Harbor',
  };

  const journey = await gpsRepository.createJourney(null, {
    truckNumber: truckNumber.trim(),
    driverName: driverName.trim(),
    origin: authoritativeOrigin,
    destination: authoritativeDestination,
    fishManifest: Array.isArray(fishManifest) ? fishManifest : [],
    status: 'DRAFT',
    publishedToCustomer: false,
  });

  domainEventsEngine.emit('gps:journey_created', {
    journeyId: journey.id,
    truckNumber: journey.truck_number,
    createdAt: journey.created_at,
  });

  return journey;
}

/**
 * List all journeys for admin
 * @param {object} [options]
 * @returns {Promise<Array>}
 */
async function listJourneys(options = {}) {
  return gpsRepository.listJourneys(null, options);
}

/**
 * Get comprehensive Admin journey details with position telemetry and staleness
 * @param {string} journeyId
 * @returns {Promise<object>}
 */
async function getAdminJourneyView(journeyId) {
  const journey = await gpsRepository.getJourneyById(null, journeyId);
  if (!journey) {
    const err = new Error('JOURNEY_NOT_FOUND');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const latestPosition = await gpsRepository.getLatestPosition(null, journeyId);
  const providerStatus = onelapAdapter.getStatus();

  let isStale = false;
  let distanceMeters = null;
  let insideGeofence = false;

  if (latestPosition) {
    const recordedTime = new Date(latestPosition.recorded_at).getTime();
    isStale = Date.now() - recordedTime > STALE_THRESHOLD_MS;

    const arrivalCheck = geofenceEngine.checkArrival(
      latestPosition.latitude,
      latestPosition.longitude,
      journey.destination
    );
    distanceMeters = arrivalCheck.distanceMeters;
    insideGeofence = arrivalCheck.arrived;
  }

  const isArrived = Boolean(journey.ended_at);
  const remainingPostArrivalMinutes = isArrived
    ? geofenceEngine.getRemainingPostArrivalMinutes(journey.ended_at)
    : null;

  return {
    journey,
    latestPosition,
    isStale,
    isArrived,
    insideGeofence,
    distanceMeters,
    remainingPostArrivalMinutes,
    providerStatus,
  };
}

/**
 * Start a journey (transitions DRAFT -> LIVE)
 * @param {string} journeyId
 * @returns {Promise<object>}
 */
async function startJourney(journeyId) {
  const journey = await gpsRepository.getJourneyById(null, journeyId);
  if (!journey) {
    const err = new Error('JOURNEY_NOT_FOUND');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (journey.status !== 'DRAFT') {
    const err = new Error(`Cannot start journey currently in status: ${journey.status}`);
    err.code = 'INVALID_JOURNEY_STATE';
    err.status = 400;
    throw err;
  }

  const updated = await gpsRepository.startJourney(null, journeyId);

  domainEventsEngine.emit('gps:journey_started', {
    journeyId: updated.id,
    truckNumber: updated.truck_number,
    startedAt: updated.started_at,
  });

  return updated;
}

/**
 * Explicitly publish or unpublish journey tracking to customers
 * @param {string} journeyId
 * @param {boolean} publishedToCustomer
 * @returns {Promise<object>}
 */
async function setCustomerPublication(journeyId, publishedToCustomer) {
  const journey = await gpsRepository.getJourneyById(null, journeyId);
  if (!journey) {
    const err = new Error('JOURNEY_NOT_FOUND');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const updated = await gpsRepository.updateCustomerPublication(
    null,
    journeyId,
    Boolean(publishedToCustomer)
  );

  domainEventsEngine.emit('gps:publication_changed', {
    journeyId: updated.id,
    publishedToCustomer: updated.published_to_customer,
  });

  // If published, broadcast immediately over WebSocket so connected customer apps discover it
  if (updated.published_to_customer) {
    const latestPos = await gpsRepository.getLatestPosition(null, journeyId);
    broadcastGPS({
      event: 'JOURNEY_PUBLISHED',
      journeyId: updated.id,
      truckNumber: updated.truck_number,
      latestPosition: latestPos,
      status: updated.status,
      timestamp: new Date().toISOString(),
    });
  } else {
    broadcastGPS({
      event: 'JOURNEY_UNPUBLISHED',
      journeyId: updated.id,
      timestamp: new Date().toISOString(),
    });
  }

  return updated;
}

/**
 * Ingest genuine GPS position telemetry
 * Performs geofence arrival detection, post-arrival window enforcement,
 * and realtime websocket broadcast.
 * @param {string} journeyId
 * @param {object} positionData
 * @returns {Promise<object>}
 */
async function ingestPosition(journeyId, {
  latitude,
  longitude,
  speed = null,
  heading = null,
  recordedAt = new Date(),
}) {
  const journey = await gpsRepository.getJourneyById(null, journeyId);
  if (!journey) {
    const err = new Error('JOURNEY_NOT_FOUND');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!isValidCoordinate(latitude, longitude)) {
    const err = new Error('INVALID_GPS_COORDINATES');
    err.code = 'VALIDATION_FAILED';
    err.status = 400;
    throw err;
  }

  // 1. Insert position record
  const position = await gpsRepository.insertPosition(null, {
    journeyId,
    latitude,
    longitude,
    speed,
    heading,
    recordedAt,
  });

  // 2. Evaluate arrival against destination geofence
  const arrivalCheck = geofenceEngine.checkArrival(
    position.latitude,
    position.longitude,
    journey.destination
  );

  let arrivalTriggered = false;
  if (arrivalCheck.arrived && !journey.ended_at) {
    // Confirmed arrival within geofence! Record arrival timestamp server-side
    await gpsRepository.markJourneyArrived(null, journeyId, position.recorded_at);
    journey.ended_at = position.recorded_at;
    arrivalTriggered = true;

    domainEventsEngine.emit('gps:arrived', {
      journeyId,
      truckNumber: journey.truck_number,
      arrivedAt: position.recorded_at,
      distanceMeters: arrivalCheck.distanceMeters,
    });
  }

  // 3. Post-arrival closure enforcement
  let customerTrackingClosed = false;
  if (journey.ended_at && !journey.customer_tracking_closed_at) {
    const isExpired = geofenceEngine.isPostArrivalWindowExpired(journey.ended_at);
    if (isExpired) {
      const now = new Date();
      await gpsRepository.closeCustomerTracking(null, journeyId, now);
      journey.customer_tracking_closed_at = now;
      customerTrackingClosed = true;

      domainEventsEngine.emit('gps:customer_tracking_closed', {
        journeyId,
        closedAt: now,
      });
    }
  }

  // 4. Broadcast on gps:live if customer publication is active
  if (journey.published_to_customer && !journey.customer_tracking_closed_at) {
    const isStale = Date.now() - new Date(position.recorded_at).getTime() > STALE_THRESHOLD_MS;

    broadcastGPS({
      event: arrivalTriggered ? 'TRUCK_ARRIVED' : 'POSITION_UPDATE',
      journeyId,
      truckNumber: journey.truck_number,
      position: {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        recordedAt: position.recorded_at,
      },
      isStale,
      isArrived: Boolean(journey.ended_at),
      distanceMeters: arrivalCheck.distanceMeters,
      insideGeofence: arrivalCheck.arrived,
      remainingPostArrivalMinutes: journey.ended_at
        ? geofenceEngine.getRemainingPostArrivalMinutes(journey.ended_at)
        : null,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    position,
    arrived: arrivalCheck.arrived,
    distanceMeters: arrivalCheck.distanceMeters,
    arrivalTriggered,
    customerTrackingClosed,
  };
}

/**
 * Stop a journey
 * @param {string} journeyId
 * @returns {Promise<object>}
 */
async function stopJourney(journeyId) {
  const journey = await gpsRepository.getJourneyById(null, journeyId);
  if (!journey) {
    const err = new Error('JOURNEY_NOT_FOUND');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const stopped = await gpsRepository.stopJourney(null, journeyId);
  // Also guarantee customer tracking is closed if journey is stopped
  if (!stopped.customer_tracking_closed_at) {
    await gpsRepository.closeCustomerTracking(null, journeyId);
  }

  domainEventsEngine.emit('gps:journey_stopped', {
    journeyId: stopped.id,
    endedAt: stopped.ended_at,
  });

  broadcastGPS({
    event: 'JOURNEY_STOPPED',
    journeyId: stopped.id,
    timestamp: new Date().toISOString(),
  });

  return stopped;
}

/**
 * Manually close customer tracking for a journey
 * @param {string} journeyId
 * @returns {Promise<object>}
 */
async function closeCustomerTracking(journeyId) {
  const journey = await gpsRepository.getJourneyById(null, journeyId);
  if (!journey) {
    const err = new Error('JOURNEY_NOT_FOUND');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const updated = await gpsRepository.closeCustomerTracking(null, journeyId);

  domainEventsEngine.emit('gps:customer_tracking_closed', {
    journeyId: updated.id,
    closedAt: updated.customer_tracking_closed_at,
  });

  broadcastGPS({
    event: 'CUSTOMER_TRACKING_CLOSED',
    journeyId: updated.id,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

/**
 * Project customer-safe delivery tracking data
 * Strictly enforces customer publication gate, post-arrival closure window,
 * and never leaks internal provider credentials or administrative fields.
 * @returns {Promise<object>}
 */
async function getCustomerLiveTracking() {
  const journey = await gpsRepository.getActiveCustomerJourney(null);

  if (!journey) {
    return {
      active: false,
      message: 'No live delivery currently published for customer tracking.',
    };
  }

  // Check if post-arrival window expired
  if (journey.ended_at) {
    const isExpired = geofenceEngine.isPostArrivalWindowExpired(journey.ended_at);
    if (isExpired) {
      // Auto-close tracking
      await gpsRepository.closeCustomerTracking(null, journey.id);
      return {
        active: false,
        closed: true,
        message: 'Delivery tracking ended. Truck has arrived at PondFish store.',
      };
    }
  }

  const latestPosition = await gpsRepository.getLatestPosition(null, journey.id);

  let isStale = false;
  let distanceMeters = null;
  let insideGeofence = false;

  if (latestPosition) {
    const recordedTime = new Date(latestPosition.recorded_at).getTime();
    isStale = Date.now() - recordedTime > STALE_THRESHOLD_MS;

    const arrivalCheck = geofenceEngine.checkArrival(
      latestPosition.latitude,
      latestPosition.longitude,
      journey.destination
    );
    distanceMeters = arrivalCheck.distanceMeters;
    insideGeofence = arrivalCheck.arrived;
  }

  const isArrived = Boolean(journey.ended_at);
  const remainingPostArrivalMinutes = isArrived
    ? geofenceEngine.getRemainingPostArrivalMinutes(journey.ended_at)
    : null;

  // Authoritative Customer Safe Projection
  return {
    active: true,
    journeyId: journey.id,
    truckNumber: journey.truck_number,
    driverName: journey.driver_name,
    origin: journey.origin ? { name: journey.origin.name || 'Harbor' } : null,
    destination: {
      name: journey.destination?.name || geofenceEngine.DEFAULT_STORE_LOCATION.name,
      address: journey.destination?.address || geofenceEngine.DEFAULT_STORE_LOCATION.address,
    },
    fishManifest: Array.isArray(journey.fish_manifest)
      ? journey.fish_manifest.map(item => ({
          fishName: item.fishName || item.name || 'Fresh Catch',
          quantityKg: item.quantityKg || item.quantity || 0,
        }))
      : [],
    status: isArrived ? 'ARRIVED' : journey.status,
    isArrived,
    startedAt: journey.started_at,
    arrivedAt: journey.ended_at,
    latestPosition: latestPosition
      ? {
          latitude: latestPosition.latitude,
          longitude: latestPosition.longitude,
          speed: latestPosition.speed,
          heading: latestPosition.heading,
          recordedAt: latestPosition.recorded_at,
        }
      : null,
    isStale,
    distanceMeters,
    insideGeofence,
    remainingPostArrivalMinutes,
    lastUpdated: latestPosition ? latestPosition.recorded_at : journey.started_at,
  };
}

/**
 * Get customer-safe view of a specific journey by ID
 * Rejects with 403/404 if not published or if tracking has closed.
 * @param {string} journeyId
 * @returns {Promise<object>}
 */
async function getCustomerJourneyById(journeyId) {
  const journey = await gpsRepository.getJourneyById(null, journeyId);
  if (!journey) {
    const err = new Error('JOURNEY_NOT_FOUND');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!journey.published_to_customer || journey.customer_tracking_closed_at) {
    const err = new Error('JOURNEY_TRACKING_UNAVAILABLE');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  // Check if post-arrival window expired
  if (journey.ended_at && geofenceEngine.isPostArrivalWindowExpired(journey.ended_at)) {
    await gpsRepository.closeCustomerTracking(null, journey.id);
    const err = new Error('JOURNEY_TRACKING_ENDED');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  const latestPosition = await gpsRepository.getLatestPosition(null, journeyId);
  let isStale = false;
  if (latestPosition) {
    isStale = Date.now() - new Date(latestPosition.recorded_at).getTime() > STALE_THRESHOLD_MS;
  }

  return {
    journeyId: journey.id,
    truckNumber: journey.truck_number,
    driverName: journey.driver_name,
    origin: journey.origin ? { name: journey.origin.name || 'Harbor' } : null,
    destination: {
      name: journey.destination?.name || geofenceEngine.DEFAULT_STORE_LOCATION.name,
      address: journey.destination?.address || geofenceEngine.DEFAULT_STORE_LOCATION.address,
    },
    fishManifest: Array.isArray(journey.fish_manifest)
      ? journey.fish_manifest.map(item => ({
          fishName: item.fishName || item.name || 'Fresh Catch',
          quantityKg: item.quantityKg || item.quantity || 0,
        }))
      : [],
    status: journey.ended_at ? 'ARRIVED' : journey.status,
    isArrived: Boolean(journey.ended_at),
    startedAt: journey.started_at,
    arrivedAt: journey.ended_at,
    latestPosition: latestPosition
      ? {
          latitude: latestPosition.latitude,
          longitude: latestPosition.longitude,
          speed: latestPosition.speed,
          heading: latestPosition.heading,
          recordedAt: latestPosition.recorded_at,
        }
      : null,
    isStale,
  };
}

module.exports = {
  name: 'GPSTrackingEngine',
  createJourney,
  listJourneys,
  getAdminJourneyView,
  startJourney,
  setCustomerPublication,
  ingestPosition,
  stopJourney,
  closeCustomerTracking,
  getCustomerLiveTracking,
  getCustomerJourneyById,
};
