/**
 * Engine 25: Transactional Outbox & Event Publishing Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Section 25)
 */
const EventEmitter = require('events');
const emitter = new EventEmitter();

module.exports = {
  name: 'DomainEventsEngine',
  emit: (event, payload) => emitter.emit(event, payload),
  on: (event, listener) => emitter.on(event, listener),
  once: (event, listener) => emitter.once(event, listener),
  off: (event, listener) => emitter.off(event, listener),
  listenerCount: (event) => emitter.listenerCount(event),
};

