/**
 * Engine 20: Central Realtime WebSocket Broadcast Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 20) & API Spec (Sec. 45)
 */
const { broadcast } = require('../realtime/ws-server');

module.exports = {
  name: 'RealtimeBroadcastEngine',
  broadcastTransaction(data) {
    return broadcast('successful_transaction', data);
  },
};
