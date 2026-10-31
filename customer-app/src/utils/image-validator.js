/**
 * Image URI Validation Helper
 * 
 * Validates whether a remote image URI is a non-empty, trimmed string.
 * Used by OptimizedFishImage to guard against empty/null sources before native image decoding.
 * 
 * @param {string|null|undefined} uri - Remote image URI
 * @returns {boolean} True if uri is a non-empty string
 */
function isValidImageUri(uri) {
  return Boolean(uri && typeof uri === 'string' && uri.trim().length > 0);
}

module.exports = {
  isValidImageUri,
};

