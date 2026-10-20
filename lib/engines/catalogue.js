/**
 * Engine 01: Product Catalogue Business Engine
 * Traceability: PondFish Core Business Engines Spec (Section 6) & API Spec (Section 10)
 * Central domain module for public & customer catalogue behavior. Zero UI code.
 */

const fishRepository = require('../db/repositories/fishRepository');
const categoryRepository = require('../db/repositories/categoryRepository');
const discountRepository = require('../db/repositories/discountRepository');

/**
 * Maps freshness enum to user-facing status and visual badge metadata
 */
function formatFreshnessBadge(freshnessState) {
  switch (freshnessState) {
    case 'GREEN':
      return {
        state: 'GREEN',
        label: '0–24h Fresh Catch',
        color: '#16A34A',
        bg: '#DCFCE7',
      };
    case 'GREY':
      return {
        state: 'GREY',
        label: '24–48h Standard Freshness',
        color: '#64748B',
        bg: '#F1F5F9',
      };
    case 'RED':
      return {
        state: 'RED',
        label: '48h+ Markdown',
        color: '#DC2626',
        bg: '#FEE2E2',
      };
    default:
      return {
        state: 'UNKNOWN',
        label: 'Fresh Arrival',
        color: '#0284C7',
        bg: '#E0F2FE',
      };
  }
}

/**
 * Calculates effective price after applicable active discount
 */
function calculateEffectivePrice(basePrice, discounts, fishId) {
  // Find fish-specific discount first, then storewide discount (fish_id = null)
  const matched = discounts.find((d) => d.fish_id === fishId) || discounts.find((d) => !d.fish_id);

  if (!matched) {
    return {
      basePrice,
      effectivePrice: basePrice,
      hasDiscount: false,
      discount: null,
    };
  }

  let effectivePrice = basePrice;
  if (matched.discount_percent) {
    const deduction = (basePrice * matched.discount_percent) / 100;
    effectivePrice = Math.max(0, basePrice - deduction);
  } else if (matched.flat_discount_amount) {
    effectivePrice = Math.max(0, basePrice - matched.flat_discount_amount);
  }

  return {
    basePrice,
    effectivePrice: parseFloat(effectivePrice.toFixed(2)),
    hasDiscount: true,
    discount: {
      code: matched.discount_code,
      percent: matched.discount_percent,
      flatAmount: matched.flat_discount_amount,
    },
  };
}

/**
 * Domain query: Retrieve public fish catalogue with computed business fields
 * @param {object} filters - { categoryId, search, onlineBookable, available }
 * @returns {Promise<Array>}
 */
async function getPublicCatalogue(filters = {}) {
  const [fishList, activeDiscounts] = await Promise.all([
    fishRepository.listPublicFish(filters),
    discountRepository.listActivePublicDiscounts().catch(() => []),
  ]);

  return fishList.map((item) => {
    const pricing = calculateEffectivePrice(item.unit_price, activeDiscounts, item.id);
    const freshness = formatFreshnessBadge(item.freshness_state);

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      imageUrl: item.image_url,
      categoryId: item.category_id,
      categoryName: item.category_name,
      unitPrice: item.unit_price,
      pricing,
      physicalAvailable: Boolean(item.physical_available),
      onlineBookable: Boolean(item.online_bookable),
      availabilityStatus: item.physical_available ? 'Available in Store' : 'Currently Out of Stock',
      bookingStatus: item.online_bookable ? 'Online Booking Eligible' : 'In-Store Purchase Only',
      freshness,
    };
  });
}

/**
 * Domain query: Retrieve details for a single fish
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getFishDetails(id) {
  const [item, activeDiscounts] = await Promise.all([
    fishRepository.findFishById(id),
    discountRepository.listActivePublicDiscounts().catch(() => []),
  ]);

  if (!item) return null;

  const pricing = calculateEffectivePrice(item.unit_price, activeDiscounts, item.id);
  const freshness = formatFreshnessBadge(item.freshness_state);

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    imageUrl: item.image_url,
    categoryId: item.category_id,
    categoryName: item.category_name,
    unitPrice: item.unit_price,
    pricing,
    physicalAvailable: Boolean(item.physical_available),
    onlineBookable: Boolean(item.online_bookable),
    availabilityStatus: item.physical_available ? 'Available in Store' : 'Currently Out of Stock',
    bookingStatus: item.online_bookable ? 'Online Booking Eligible' : 'In-Store Purchase Only',
    freshness,
  };
}

/**
 * Domain query: Retrieve active categories
 * @returns {Promise<Array>}
 */
async function getCategories() {
  return categoryRepository.listActiveCategories();
}

/**
 * Domain query: Retrieve active public discount offers
 * @returns {Promise<Array>}
 */
async function getActiveOffers() {
  return discountRepository.listActivePublicDiscounts();
}

module.exports = {
  name: 'ProductCatalogueEngine',
  getPublicCatalogue,
  getFishDetails,
  getCategories,
  getActiveOffers,
};
