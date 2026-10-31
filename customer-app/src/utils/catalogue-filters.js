/**
 * Catalogue Filtering and Styling Helpers
 * 
 * Pure production helpers extracted from HomeScreen & FishCard for direct testability.
 */

/**
 * Filter catalogue fish items by category, availability, and search query.
 *
 * @param {Array} fishList - Raw list of fish items
 * @param {Object} filters
 * @param {string|null} filters.categoryId - Selected category ID or null for all
 * @param {'ALL'|'BOOKABLE'|'IN_STORE'|'DISCOUNT'} filters.availability - Availability filter key
 * @param {string} filters.searchQuery - User search query string
 * @returns {Array} Filtered list of fish items
 */
function filterFishCatalogue(fishList = [], { categoryId = null, availability = 'ALL', searchQuery = '' } = {}) {
  if (!Array.isArray(fishList)) return [];

  return fishList.filter((item) => {
    if (!item) return false;

    // 1. Category Filter
    if (categoryId && item.categoryId !== categoryId) {
      return false;
    }

    // 2. Availability Filter
    if (availability === 'BOOKABLE' && !item.onlineBookable) {
      return false;
    }
    if (availability === 'IN_STORE' && (!item.physicalAvailable || item.onlineBookable)) {
      return false;
    }
    if (availability === 'DISCOUNT' && (!item.pricing || !item.pricing.hasDiscount)) {
      return false;
    }

    // 3. Search Filter
    if (typeof searchQuery === 'string' && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = item.name && item.name.toLowerCase().includes(q);
      const descMatch = item.description && item.description.toLowerCase().includes(q);
      const catMatch = item.categoryName && item.categoryName.toLowerCase().includes(q);
      if (!nameMatch && !descMatch && !catMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Category badge style helper based on category taxonomy
 *
 * @param {string} categoryName - Category display name
 * @returns {{ backgroundColor: string }} Brand badge background style
 */
function getCategoryBadgeStyle(categoryName = '') {
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('marine')) return { backgroundColor: '#0284C7' };
  if (cat.includes('shell') || cat.includes('prawn')) return { backgroundColor: '#D97706' };
  if (cat.includes('pond') || cat.includes('live')) return { backgroundColor: '#059669' };
  return { backgroundColor: '#0A1C33' };
}

module.exports = {
  filterFishCatalogue,
  getCategoryBadgeStyle,
};
