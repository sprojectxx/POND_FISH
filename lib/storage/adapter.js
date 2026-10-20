/**
 * Abstract File Storage Interface
 * Traceability: Final Reconciliation & Architecture Lock (Issue 3)
 * Production storage provider is TBD.
 */

class StorageAdapter {
  /**
   * Save a file buffer to storage
   * @param {string} key - Unique storage path/key
   * @param {Buffer} buffer - File data
   * @param {string} mimeType - File MIME type
   * @returns {Promise<{ key: string, url: string, size: number }>}
   */
  async upload(key, buffer, mimeType) {
    throw new Error('Method not implemented: upload()');
  }

  /**
   * Retrieve file buffer by key
   * @param {string} key
   * @returns {Promise<Buffer>}
   */
  async get(key) {
    throw new Error('Method not implemented: get()');
  }

  /**
   * Delete file by key
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    throw new Error('Method not implemented: delete()');
  }
}

module.exports = { StorageAdapter };
