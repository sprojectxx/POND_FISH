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
    const storeId = options.storeId || data?.storeId || (options.channel ? null : process.env.PONDFISH_STORE_ID);

    // Fail closed if store identity cannot be determined and no explicit channel is provided
    if (!storeId && !options.channel) {
      console.warn('[REALTIME BROADCAST] Skipped transaction broadcast: Store identity cannot be determined.');
      return { deliveredCount: 0, reason: 'UNDETERMINED_STORE' };
    }

    const channel = options.channel || `tv:store:${storeId}`;
    return broadcast('successful_transaction', data, {
      channel,
      storeId: storeId || null,
      ...options,
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
