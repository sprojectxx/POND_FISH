/**
 * Central Business Engine Registry
 * Traceability: Documentation/PondFish_Core_Business_Engines_Specification_v1.md
 * 
 * NOTE: These 26 engines are in-process logical domain modules within a Modular Monolith.
 * They are NOT separate microservices or independent network services.
 */

const catalogueEngine = require('./catalogue');
const freshnessEngine = require('./freshness');
const discountEngine = require('./discount');
const inventoryEngine = require('./inventory');
const subscriptionPlanEngine = require('./subscription-plan');
const customerSubscriptionEngine = require('./customer-subscription');
const subscriptionLedgerEngine = require('./subscription-ledger');
const bookingEngine = require('./booking');
const bookingExpiryEngine = require('./booking-expiry');
const qrVerificationEngine = require('./qr-verification');
const billOcrEngine = require('./bill-ocr');
const billingCorrectionEngine = require('./billing-correction');
const posFinalizationEngine = require('./pos-finalization');
const tvFeedEngine = require('./tv-feed');
const adminDashboardEngine = require('./admin-dashboard');
const adminCrudEngine = require('./admin-crud');
const auditEngine = require('./audit');
const gpsTrackingEngine = require('./gps-tracking');
const notificationsEngine = require('./notifications');
const realtimeBroadcastEngine = require('./realtime-broadcast');
const offlineResilienceEngine = require('./offline-resilience');
const rbacEngine = require('./rbac');
const crossPortalStateEngine = require('./cross-portal-state');
const idempotencyEngine = require('./idempotency');
const domainEventsEngine = require('./domain-events');
const businessSettingsEngine = require('./business-settings');

module.exports = {
  catalogueEngine,
  freshnessEngine,
  discountEngine,
  inventoryEngine,
  subscriptionPlanEngine,
  customerSubscriptionEngine,
  subscriptionLedgerEngine,
  bookingEngine,
  bookingExpiryEngine,
  qrVerificationEngine,
  billOcrEngine,
  billingCorrectionEngine,
  posFinalizationEngine,
  tvFeedEngine,
  adminDashboardEngine,
  adminCrudEngine,
  auditEngine,
  gpsTrackingEngine,
  notificationsEngine,
  realtimeBroadcastEngine,
  offlineResilienceEngine,
  rbacEngine,
  crossPortalStateEngine,
  idempotencyEngine,
  domainEventsEngine,
  businessSettingsEngine,
};
