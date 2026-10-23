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
    const channel = options.storeId ? `tv:store:${options.storeId}` : (options.channel || 'tv:transactions');
    return broadcast('successful_transaction', data, { channel, ...options });
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
