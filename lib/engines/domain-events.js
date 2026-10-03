/**
 * Engine 25: Transactional Outbox & Event Publishing Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 25)
 */
const db = require('../db/pool');

module.exports = {
  name: 'DomainEventsEngine',
};
