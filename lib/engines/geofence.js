/**
 * Engine: Geofence Arrival & Proximity Engine
 * Traceability: PondFish Master PRD v2 (Sections 22.4, 22.5), Integration Spec (Section 9.6)
 * Calculates Haversine spherical distance, checks geofenced arrival against configured store coordinates,
 * and handles post-arrival customer tracking closure window.
 */

// Authoritative configuration defaults (Bangalore Flagship Counter / Water Town Store)
const DEFAULT_STORE_LOCATION = {
  name: 'PondFish Main Store',
  address: process.env.PONDFISH_STORE_ADDRESS || '123 Fresh Lake Road, Water Town, AP',
  latitude: parseFloat(process.env.PONDFISH_STORE_LATITUDE || '12.9716'),
  longitude: parseFloat(process.env.PONDFISH_STORE_LONGITUDE || '77.5946'),
  geofenceRadiusMeters: parseInt(process.env.PONDFISH_GEOFENCE_RADIUS_METERS || '500', 10),
  postArrivalTrackingMinutes: parseInt(process.env.PONDFISH_POST_ARRIVAL_TRACKING_MINUTES || '45', 10),
};

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
    lat1 === null || lat1 === undefined ||
    lon1 === null || lon1 === undefined ||
    lat2 === null || lat2 === undefined ||
    lon2 === null || lon2 === undefined
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
 * Evaluate arrival for current GPS coordinates against journey destination or default store
 * @param {number} currentLat
 * @param {number} currentLon
 * @param {object} [destination] - Optional destination object with { latitude, longitude, geofenceRadiusMeters }
 * @returns {{ arrived: boolean, distanceMeters: number, target: object }}
 */
function checkArrival(currentLat, currentLon, destination = null) {
  const targetLat = destination && typeof destination.latitude === 'number'
    ? destination.latitude
    : DEFAULT_STORE_LOCATION.latitude;

  const targetLon = destination && typeof destination.longitude === 'number'
    ? destination.longitude
    : DEFAULT_STORE_LOCATION.longitude;

  const radiusMeters = destination && typeof destination.geofenceRadiusMeters === 'number'
    ? destination.geofenceRadiusMeters
    : DEFAULT_STORE_LOCATION.geofenceRadiusMeters;

  const distanceMeters = Math.round(calculateDistanceMeters(currentLat, currentLon, targetLat, targetLon));
  const arrived = distanceMeters <= radiusMeters;

  return {
    arrived,
    distanceMeters,
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

  const windowMinutes = durationMinutes !== null
    ? durationMinutes
    : DEFAULT_STORE_LOCATION.postArrivalTrackingMinutes;

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

  const windowMinutes = durationMinutes !== null
    ? durationMinutes
    : DEFAULT_STORE_LOCATION.postArrivalTrackingMinutes;

  const expiryTime = arrivalTime + windowMinutes * 60 * 1000;
  const diffMs = expiryTime - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (60 * 1000));
}

module.exports = {
  DEFAULT_STORE_LOCATION,
  calculateDistanceMeters,
  isInsideGeofence,
  checkArrival,
  isPostArrivalWindowExpired,
  getRemainingPostArrivalMinutes,
};
