/**
 * GPS Telemetry Adapter (Simulation Driver Deprecated)
 * Traceability: PondFish Integration Specification v1 & Master PRD v2 (Section 22)
 * Simulated coordinates and fake movements are explicitly prohibited.
 * Genuine telemetry enters via the authenticated ingestion boundary or configured OneLap adapter.
 */

const { onelapAdapter } = require('../../engines/onelap-adapter');

class GPSSimulationAdapter {
  constructor() {
    this.provider = onelapAdapter;
  }

  isConfigured() {
    return false;
  }

  getStatus() {
    return {
      status: 'SIMULATION_DISABLED',
      message: 'Simulation driver disabled per authoritative requirements. Genuine telemetry ingestion active.',
    };
  }
}

module.exports = { GPSSimulationAdapter };
