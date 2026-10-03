/**
 * Storage Adapter Factory
 * Traceability: Final Reconciliation & Architecture Lock (Issue 3)
 * Production Cloud Provider: TBD (Decoupled abstraction)
 */

const { LocalFileStorage } = require('./local-storage');

let instance = null;

function getStorage() {
  if (!instance) {
    const driver = process.env.STORAGE_DRIVER || 'local';
    if (driver === 'local') {
      const uploadPath = process.env.LOCAL_STORAGE_PATH || './uploads';
      instance = new LocalFileStorage(uploadPath);
    } else {
      throw new Error(`Production storage driver "${driver}" is not configured. Production cloud provider remains TBD.`);
    }
  }
  return instance;
}

module.exports = {
  getStorage,
};
