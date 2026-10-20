/**
 * Central GPS Tracking Adapter Factory
 * Traceability: PondFish Integration Specification v1
 * OneLap Production Credentials: TBD
 */

const { onelapAdapter } = require('../../engines/onelap-adapter');

function getGPSAdapter() {
  return onelapAdapter;
}

module.exports = {
  getGPSAdapter,
};
