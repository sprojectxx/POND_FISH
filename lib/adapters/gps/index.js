/**
 * Central GPS Tracking Adapter Factory
 * Traceability: PondFish Integration Specification v1
 * OneLap Production Credentials: TBD
 */

const { GPSSimulationAdapter } = require('./simulator');

let adapterInstance = null;

function getGPSAdapter() {
  if (!adapterInstance) {
    const mode = process.env.GPS_ADAPTER_MODE || 'simulation';
    if (mode === 'simulation') {
      adapterInstance = new GPSSimulationAdapter();
    } else {
      throw new Error(`Production OneLap GPS adapter is not configured. Production credentials remain TBD.`);
    }
  }
  return adapterInstance;
}

module.exports = {
  getGPSAdapter,
};
