/**
 * Engine: Geofence Arrival & Proximity Engine
 * Traceability: PondFish Master PRD v2 (Sections 22.4, 22.5), Integration Spec (Section 9.6)
 * Calculates Haversine spherical distance, checks geofenced arrival against configured store coordinates,
 * and handles post-arrival customer tracking closure window.
 * 
 * STRICT CONFIGURATION RULE:
 * Store geofence coordinates must be configuration-driven. Zero hardcoded coordinates.
 * Post-arrival window is constrained to the documented 30–60 minute range (PRD Section 22.5).
 */

/**
 * Get configured store location parameters
 * @returns {object}
 */
function getStoreConfig() {
  const latStr = process.env.PONDFISH_STORE_LATITUDE;
  const lonStr = process.env.PONDFISH_STORE_LONGITUDE;
  const radiusStr = process.env.PONDFISH_GEOFENCE_RADIUS_METERS;
  const minutesStr = process.env.PONDFISH_POST_ARRIVAL_TRACKING_MINUTES;

  const latitude = latStr !== undefined && latStr !== null && latStr.trim() !== '' ? parseFloat(latStr) : null;
  const longitude = lonStr !== undefined && lonStr !== null && lonStr.trim() !== '' ? parseFloat(lonStr) : null;
  const geofenceRadiusMeters = radiusStr ? parseInt(radiusStr, 10) : 500;

  // PRD Section 22.5: Configurable 30–60 minutes
  const parsedMinutes = minutesStr ? parseInt(minutesStr, 10) : 45;
  const postArrivalTrackingMinutes = Math.min(60, Math.max(30, isNaN(parsedMinutes) ? 45 : parsedMinutes));

  const isConfigured = latitude !== null && !isNaN(latitude) && longitude !== null && !isNaN(longitude);

  return {
    name: process.env.PONDFISH_STORE_NAME || 'PondFish Main Store',
    address: process.env.PONDFISH_STORE_ADDRESS || '123 Fresh Lake Road, Water Town, AP',
    latitude: isConfigured ? latitude : null,
    longitude: isConfigured ? longitude : null,
    geofenceRadiusMeters: !isNaN(geofenceRadiusMeters) ? geofenceRadiusMeters : 500,
    postArrivalTrackingMinutes,
    isConfigured,
  };
}

/**
 * Calculate Great-Circle distance between two coordinates in meters using Haversine formula
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null || lat1 === undefined || isNaN(lat1) ||
    lon1 === null || lon1 === undefined || isNaN(lon1) ||
    lat2 === null || lat2 === undefined || isNaN(lat2) ||
    lon2 === null || lon2 === undefined || isNaN(lon2)
  ) {
    return Infinity;
  }

  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check whether a coordinate falls inside a target circular geofence
 * @param {number} lat
 * @param {number} lon
 * @param {number} targetLat
 * @param {number} targetLon
 * @param {number} radiusMeters
 * @returns {boolean}
 */
function isInsideGeofence(lat, lon, targetLat, targetLon, radiusMeters) {
  const distance = calculateDistanceMeters(lat, lon, targetLat, targetLon);
  return distance <= radiusMeters;
}

/**
 * Evaluate arrival for current GPS coordinates against journey destination or configured store
 * @param {number} currentLat
 * @param {number} currentLon
 * @param {object} [destination] - Optional destination object with { latitude, longitude, geofenceRadiusMeters }
 * @returns {{ arrived: boolean, distanceMeters: number|null, isGeofenceConfigured: boolean, target: object|null }}
 */
function checkArrival(currentLat, currentLon, destination = null) {
  const storeConfig = getStoreConfig();

  const targetLat = destination && typeof destination.latitude === 'number' && !isNaN(destination.latitude)
    ? destination.latitude
    : storeConfig.latitude;

  const targetLon = destination && typeof destination.longitude === 'number' && !isNaN(destination.longitude)
    ? destination.longitude
    : storeConfig.longitude;

  const radiusMeters = destination && typeof destination.geofenceRadiusMeters === 'number' && !isNaN(destination.geofenceRadiusMeters)
    ? destination.geofenceRadiusMeters
    : storeConfig.geofenceRadiusMeters;

  // If neither destination nor environment provided coordinates, geofence cannot be evaluated
  if (targetLat === null || targetLon === null) {
    return {
      arrived: false,
      distanceMeters: null,
      isGeofenceConfigured: false,
      target: null,
    };
  }

  const rawDist = calculateDistanceMeters(currentLat, currentLon, targetLat, targetLon);
  const distanceMeters = isFinite(rawDist) ? Math.round(rawDist) : null;
  const arrived = distanceMeters !== null && distanceMeters <= radiusMeters;

  return {
    arrived,
    distanceMeters,
    isGeofenceConfigured: true,
    target: {
      latitude: targetLat,
      longitude: targetLon,
      radiusMeters,
    },
  };
}

/**
 * Check if the post-arrival customer tracking duration has expired
 * @param {Date|string} arrivedAt
 * @param {number} [durationMinutes]
 * @returns {boolean}
 */
function isPostArrivalWindowExpired(arrivedAt, durationMinutes = null) {
  if (!arrivedAt) return false;
  const arrivalTime = new Date(arrivedAt).getTime();
  if (isNaN(arrivalTime)) return false;

  const storeConfig = getStoreConfig();
  const rawMinutes = durationMinutes !== null ? durationMinutes : storeConfig.postArrivalTrackingMinutes;
  const windowMinutes = Math.min(60, Math.max(30, rawMinutes));

  const expiryTime = arrivalTime + windowMinutes * 60 * 1000;
  return Date.now() >= expiryTime;
}

/**
 * Get remaining minutes in post-arrival tracking window
 * @param {Date|string} arrivedAt
 * @param {number} [durationMinutes]
 * @returns {number} remaining minutes (0 if expired)
 */
function getRemainingPostArrivalMinutes(arrivedAt, durationMinutes = null) {
  if (!arrivedAt) return 0;
  const arrivalTime = new Date(arrivedAt).getTime();
  if (isNaN(arrivalTime)) return 0;

  const storeConfig = getStoreConfig();
  const rawMinutes = durationMinutes !== null ? durationMinutes : storeConfig.postArrivalTrackingMinutes;
  const windowMinutes = Math.min(60, Math.max(30, rawMinutes));

  const expiryTime = arrivalTime + windowMinutes * 60 * 1000;
  const diffMs = expiryTime - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (60 * 1000));
}

module.exports = {
  getStoreConfig,
  calculateDistanceMeters,
  isInsideGeofence,
  checkArrival,
  isPostArrivalWindowExpired,
  getRemainingPostArrivalMinutes,
};
