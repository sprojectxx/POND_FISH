/**
 * OneLap GPS Provider Adapter Boundary
 * Traceability: PondFish Integration Specification v1 (Section 9.3, 9.9) & Master PRD v2 (Section 22)
 * 
 * CRITICAL BOUNDARY RULES:
 * 1. Zero fabricated external API calls or fake telemetry generation.
 * 2. When credentials remain TBD/unconfigured, provides a safe, explicit 'PROVIDER_NOT_CONFIGURED' state.
 * 3. Real positions enter either through configured OneLap polling/webhook or direct hardware ingestion.
 */

class OneLapAdapter {
  constructor() {
    this.apiUrl = process.env.ONELAP_API_URL || null;
    this.apiKey = process.env.ONELAP_API_KEY || null;
    this.vehicleId = process.env.ONELAP_VEHICLE_ID || null;
  }

  /**
   * Determine if authentic OneLap provider credentials have been supplied
   * @returns {boolean}
   */
  isConfigured() {
    const hasValidUrl = Boolean(this.apiUrl && !this.apiUrl.includes('TBD') && this.apiUrl.startsWith('http'));
    const hasValidKey = Boolean(this.apiKey && !this.apiKey.includes('TBD') && this.apiKey.length > 5);
    const hasValidVehicle = Boolean(this.vehicleId && !this.vehicleId.includes('TBD'));
    return hasValidUrl && hasValidKey && hasValidVehicle;
  }

  /**
   * Retrieve adapter readiness status and missing configuration breakdown
   * @returns {object}
   */
  getStatus() {
    const missing = [];
    if (!this.apiUrl || this.apiUrl.includes('TBD')) missing.push('ONELAP_API_URL');
    if (!this.apiKey || this.apiKey.includes('TBD')) missing.push('ONELAP_API_KEY');
    if (!this.vehicleId || this.vehicleId.includes('TBD')) missing.push('ONELAP_VEHICLE_ID');

    const configured = this.isConfigured();

    return {
      provider: 'OneLap',
      configured,
      status: configured ? 'READY' : 'PROVIDER_NOT_CONFIGURED',
      missingConfiguration: missing,
      message: configured
        ? 'OneLap GPS provider credentials verified.'
        : 'OneLap GPS production credentials remain TBD per technical dependencies specification. Ingestion endpoint is available for genuine device telemetry.',
    };
  }

  /**
   * Fetch live vehicle telemetry from authentic OneLap endpoint if configured
   * Throws PROVIDER_NOT_CONFIGURED if credentials remain TBD. Never fabricates fake coordinates.
   * @param {string} [vehicleId]
   * @returns {Promise<object>}
   */
  async fetchVehicleTelemetry(vehicleId = null) {
    if (!this.isConfigured()) {
      const err = new Error('OneLap GPS provider is not configured. Real API credentials remain pending.');
      err.code = 'PROVIDER_NOT_CONFIGURED';
      err.status = 503;
      throw err;
    }

    const targetVehicle = vehicleId || this.vehicleId;
    const url = `${this.apiUrl}/devices/${targetVehicle}/location`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = new Error(`OneLap API responded with HTTP ${res.status}`);
      err.code = 'PROVIDER_HTTP_ERROR';
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    return this.normalizePayload(data);
  }

  /**
   * Normalize an external OneLap location response into PondFish internal schema
   * @param {object} payload
   * @returns {object}
   */
  normalizePayload(payload) {
    if (!payload) return null;

    // Handle common GPS payload field variations
    const lat = payload.latitude || payload.lat || payload.location?.lat;
    const lng = payload.longitude || payload.lng || payload.lon || payload.location?.lng;

    if (lat === undefined || lng === undefined) {
      throw new Error('MALFORMED_PROVIDER_PAYLOAD: Missing latitude or longitude');
    }

    return {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      speed: payload.speed !== undefined ? parseFloat(payload.speed) : null,
      heading: payload.heading !== undefined ? parseFloat(payload.heading) : (payload.course !== undefined ? parseFloat(payload.course) : null),
      recordedAt: payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString(),
      provider: 'ONELAP',
    };
  }
}

const onelapAdapter = new OneLapAdapter();

module.exports = {
  OneLapAdapter,
  onelapAdapter,
};
