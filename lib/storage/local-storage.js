/**
 * Local Filesystem Storage Adapter (Development Driver)
 * Traceability: Final Reconciliation & Architecture Lock (Issue 3)
 */

const fs = require('fs');
const path = require('path');
const { StorageAdapter } = require('./adapter');

class LocalFileStorage extends StorageAdapter {
  constructor(baseDir = './uploads') {
    super();
    this.baseDir = path.resolve(process.cwd(), baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(key, buffer, mimeType) {
    const filePath = path.join(this.baseDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, buffer);
    return {
      key,
      url: `/uploads/${key}`,
      size: buffer.length,
      mimeType,
    };
  }

  async get(key) {
    const filePath = path.join(this.baseDir, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.promises.readFile(filePath);
  }

  async delete(key) {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }
}

module.exports = { LocalFileStorage };
