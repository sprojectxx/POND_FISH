/**
 * GPS Journey Telemetry Adapter (Simulation Driver)
 * Traceability: PondFish Integration Specification v1 & Core Business Engines (Engine 18)
 * Production OneLap Credentials: TBD
 */

class GPSSimulationAdapter {
  constructor() {
    // PondFish Store Coordinates (Default target location)
    this.storeLocation = {
      latitude: 12.9716,
      longitude: 77.5946,
      address: 'PondFish Retail Store, Bangalore',
    };
  }

  /**
   * Generates a simulated position along a route towards the store
   * @param {string} journeyId
   * @param {number} progressFraction (0.0 to 1.0)
   */
  generatePosition(journeyId, progressFraction = 0.5) {
    const originLat = 13.0827;
    const originLng = 80.2707;

    const currentLat = originLat + (this.storeLocation.latitude - originLat) * progressFraction;
    const currentLng = originLng + (this.storeLocation.longitude - originLng) * progressFraction;

    return {
      journeyId,
      latitude: parseFloat(currentLat.toFixed(6)),
      longitude: parseFloat(currentLng.toFixed(6)),
      speed: 42.5,
      heading: 260.0,
      recordedAt: new Date().toISOString(),
      provider: 'SIMULATION',
    };
  }

  async getLatestPosition(journeyId) {
    return this.generatePosition(journeyId, 0.75);
  }
}

module.exports = { GPSSimulationAdapter };
