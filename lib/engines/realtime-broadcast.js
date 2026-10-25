/**
 * Engine 20: Central Realtime WebSocket Broadcast Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 20) & API Spec (Sec. 45)
 */
const {
  broadcast,
  broadcastToCustomer,
  broadcastToWorkers,
} = require('../realtime/ws-server');

module.exports = {
  name: 'RealtimeBroadcastEngine',
  broadcastTransaction(data, options = {}) {
    // Determine authoritative storeId from options, payload, or environment
    const storeId = options.storeId || data?.storeId || process.env.PONDFISH_STORE_ID;

    // Fail closed if store identity cannot be determined (even if options.channel is supplied)
    if (!storeId) {
      console.warn('[REALTIME BROADCAST] Skipped transaction broadcast: Store identity cannot be determined.');
      return { deliveredCount: 0, reason: 'UNDETERMINED_STORE' };
    }

    // Prevent store-specific transaction events from using a global channel
    // or a caller-supplied channel that does not match the authoritative store
    if (options.channel) {
      const expectedChannel = `tv:store:${storeId}`;
      if (options.channel !== expectedChannel) {
        console.warn(`[REALTIME BROADCAST] Rejected channel bypass: Channel ${options.channel} does not match authoritative store ${storeId}`);
        return { deliveredCount: 0, reason: 'STORE_CHANNEL_MISMATCH' };
      }
    }

    const channel = `tv:store:${storeId}`;
    return broadcast('successful_transaction', data, {
      ...options,
      channel,
      storeId,
    });
  },
  broadcastGPS(data) {
    return broadcast('gps:live', data, { channel: 'gps:live', requireAdmin: true });
  },
  broadcastCustomerEvent(customerId, event, data) {
    return broadcastToCustomer(customerId, event, data);
  },
  broadcastWorkerEvent(event, data, options = {}) {
    return broadcastToWorkers(event, data, options);
  },
};
