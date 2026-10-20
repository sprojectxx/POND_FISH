const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const geofenceEngine = require('../../lib/engines/geofence');

describe('Geofence & Distance Calculation Engine', () => {
  // Coordinates for reference:
  // Hyderabad Charminar: 17.3616, 78.4747
  // Hyderabad Golconda: 17.3833, 78.4011 (~8km distance)
  const p1 = { lat: 17.3616, lon: 78.4747 };
  const p2 = { lat: 17.3833, lon: 78.4011 };

  it('calculates 0 meters for identical coordinates', () => {
    const dist = geofenceEngine.calculateDistanceMeters(p1.lat, p1.lon, p1.lat, p1.lon);
    assert.strictEqual(dist, 0);
  });

  it('calculates spherical Haversine distance within acceptable tolerance', () => {
    const dist = geofenceEngine.calculateDistanceMeters(p1.lat, p1.lon, p2.lat, p2.lon);
    // Expected distance between Charminar and Golconda is roughly 8100-8300m
    assert.ok(dist > 7500 && dist < 8500, `Expected ~8000m, got ${dist}`);
  });

  it('accurately identifies whether points fall inside a specified geofence radius', () => {
    // 100 meters away from p1
    // 0.0005 deg latitude is ~55 meters
    const nearby = { lat: p1.lat + 0.0005, lon: p1.lon };
    assert.strictEqual(
      geofenceEngine.isInsideGeofence(nearby.lat, nearby.lon, p1.lat, p1.lon, 200),
      true,
      'Should be inside 200m radius'
    );

    assert.strictEqual(
      geofenceEngine.isInsideGeofence(p2.lat, p2.lon, p1.lat, p1.lon, 500),
      false,
      'Point 8km away should not be inside 500m radius'
    );
  });

  it('enforces post-arrival tracking window constraints (30-60 min range)', () => {
    const now = new Date();
    // 10 minutes ago
    const recentArrival = new Date(now.getTime() - 10 * 60 * 1000);
    // 70 minutes ago (expired for any valid window between 30-60m)
    const oldArrival = new Date(now.getTime() - 70 * 60 * 1000);

    const remainingRecent = geofenceEngine.getRemainingPostArrivalMinutes(recentArrival, 45);
    assert.ok(remainingRecent > 30 && remainingRecent <= 35, `Remaining should be ~35m, got ${remainingRecent}`);

    const remainingOld = geofenceEngine.getRemainingPostArrivalMinutes(oldArrival, 45);
    assert.strictEqual(remainingOld, 0, 'Old arrival should have 0 remaining minutes');
  });
});
