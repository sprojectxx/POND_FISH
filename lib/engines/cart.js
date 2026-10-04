/**
 * Engine 09: Cart & Checkout Calculation Business Engine
 * Traceability: PondFish Core Business Engines Spec (Section 13) & API Spec (Section 13)
 * Authoritative in-memory domain module for customer cart validation, pricing calculation,
 * and online-booking eligibility enforcement. Zero DDL/schema changes.
 */

const fishRepository = require('../db/repositories/fishRepository');
const discountRepository = require('../db/repositories/discountRepository');

// Ephemeral customer carts: customerId -> Map<fishId, { fishId, quantity, addedAt }>
const customerCarts = new Map();

/**
 * Calculates effective price after applicable active discount (reusing shared domain logic)
 */
function calculateEffectivePrice(basePrice, discounts, fishId) {
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
 * Validates UUID format
 */
function isValidUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Get internal cart map for customer
 */
function getCustomerMap(customerId) {
  if (!customerCarts.has(customerId)) {
    customerCarts.set(customerId, new Map());
  }
  return customerCarts.get(customerId);
}

/**
 * Retrieve authoritative customer cart with live pricing and eligibility revalidation
 * @param {string} customerId
 * @returns {Promise<{ items: Array, summary: object }>}
 */
async function getCart(customerId) {
  if (!customerId) {
    throw new Error('CUSTOMER_ID_REQUIRED');
  }

  const cartMap = getCustomerMap(customerId);
  const activeDiscounts = await discountRepository.listActivePublicDiscounts().catch(() => []);

  const items = [];
  let totalQuantity = 0;
  let totalAmount = 0;
  let isAllBookable = true;

  for (const [fishId, entry] of cartMap.entries()) {
    const fish = await fishRepository.findFishById(fishId);

    if (!fish) {
      // Fish was deleted from database; remove from cart
      cartMap.delete(fishId);
      continue;
    }

    const pricing = calculateEffectivePrice(fish.unit_price, activeDiscounts, fish.id);
    const subtotal = parseFloat((entry.quantity * pricing.effectivePrice).toFixed(2));
    const isAvailable = Boolean(fish.physical_available);
    const isOnlineBookable = Boolean(fish.online_bookable);

    if (!isAvailable || !isOnlineBookable) {
      isAllBookable = false;
    }

    totalQuantity += entry.quantity;
    totalAmount += subtotal;

    items.push({
      fishId: fish.id,
      name: fish.name,
      description: fish.description,
      imageUrl: fish.image_url,
      categoryName: fish.category_name,
      quantity: entry.quantity,
      unitPrice: fish.unit_price,
      effectivePrice: pricing.effectivePrice,
      hasDiscount: pricing.hasDiscount,
      discount: pricing.discount,
      subtotal,
      physicalAvailable: isAvailable,
      onlineBookable: isOnlineBookable,
      availabilityWarning: !isAvailable ? 'This fish is currently out of stock.' : null,
      bookingWarning: !isOnlineBookable ? 'This fish is no longer available for online booking.' : null,
      addedAt: entry.addedAt,
    });
  }

  // Sort items by added timestamp
  items.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));

  return {
    items,
    summary: {
      totalItems: items.length,
      totalQuantity: parseFloat(totalQuantity.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      isAllBookable,
    },
  };
}

/**
 * Add an eligible fish to the customer's cart
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.fishId
 * @param {number} params.quantity - Quantity in kg (e.g. 1, 1.5, 2)
 * @returns {Promise<object>} Authoritative cart
 */
async function addItem({ customerId, fishId, quantity }) {
  if (!customerId) {
    const err = new Error('CUSTOMER_ID_REQUIRED');
    err.code = 'CUSTOMER_ID_REQUIRED';
    throw err;
  }

  if (!isValidUuid(fishId)) {
    const err = new Error('INVALID_FISH_ID');
    err.code = 'INVALID_FISH_ID';
    throw err;
  }

  const parsedQty = parseFloat(quantity);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    const err = new Error('INVALID_QUANTITY');
    err.code = 'INVALID_QUANTITY';
    throw err;
  }

  if (parsedQty > 100) {
    const err = new Error('QUANTITY_EXCEEDS_LIMIT');
    err.code = 'QUANTITY_EXCEEDS_LIMIT';
    throw err;
  }

  // Verify fish directly against authoritative PostgreSQL database
  const fish = await fishRepository.findFishById(fishId);
  if (!fish) {
    const err = new Error('FISH_NOT_FOUND');
    err.code = 'FISH_NOT_FOUND';
    throw err;
  }

  // Business rule 1: Must be physically available
  if (!fish.physical_available) {
    const err = new Error('FISH_UNAVAILABLE');
    err.code = 'FISH_UNAVAILABLE';
    throw err;
  }

  // Business rule 2: Must be explicitly enabled for online booking
  if (!fish.online_bookable) {
    const err = new Error('FISH_NOT_ONLINE_BOOKABLE');
    err.code = 'FISH_NOT_ONLINE_BOOKABLE';
    throw err;
  }

  const cartMap = getCustomerMap(customerId);
  const existing = cartMap.get(fishId);
  const newQty = existing ? parseFloat((existing.quantity + parsedQty).toFixed(2)) : parsedQty;

  cartMap.set(fishId, {
    fishId,
    quantity: newQty,
    addedAt: existing ? existing.addedAt : new Date().toISOString(),
  });

  return getCart(customerId);
}

/**
 * Update quantity of a fish item in the customer's cart
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.fishId
 * @param {number} params.quantity
 * @returns {Promise<object>} Authoritative cart
 */
async function updateItemQuantity({ customerId, fishId, quantity }) {
  if (!customerId) {
    const err = new Error('CUSTOMER_ID_REQUIRED');
    err.code = 'CUSTOMER_ID_REQUIRED';
    throw err;
  }

  if (!isValidUuid(fishId)) {
    const err = new Error('INVALID_FISH_ID');
    err.code = 'INVALID_FISH_ID';
    throw err;
  }

  const parsedQty = parseFloat(quantity);
  if (isNaN(parsedQty) || parsedQty < 0) {
    const err = new Error('INVALID_QUANTITY');
    err.code = 'INVALID_QUANTITY';
    throw err;
  }

  const cartMap = getCustomerMap(customerId);
  if (!cartMap.has(fishId)) {
    const err = new Error('CART_ITEM_NOT_FOUND');
    err.code = 'CART_ITEM_NOT_FOUND';
    throw err;
  }

  // If quantity reduced to 0, remove item
  if (parsedQty === 0) {
    cartMap.delete(fishId);
    return getCart(customerId);
  }

  if (parsedQty > 100) {
    const err = new Error('QUANTITY_EXCEEDS_LIMIT');
    err.code = 'QUANTITY_EXCEEDS_LIMIT';
    throw err;
  }

  // Revalidate fish in database
  const fish = await fishRepository.findFishById(fishId);
  if (!fish || !fish.physical_available) {
    const err = new Error('FISH_UNAVAILABLE');
    err.code = 'FISH_UNAVAILABLE';
    throw err;
  }

  if (!fish.online_bookable) {
    const err = new Error('FISH_NOT_ONLINE_BOOKABLE');
    err.code = 'FISH_NOT_ONLINE_BOOKABLE';
    throw err;
  }

  const existing = cartMap.get(fishId);
  cartMap.set(fishId, {
    fishId,
    quantity: parsedQty,
    addedAt: existing.addedAt,
  });

  return getCart(customerId);
}

/**
 * Remove an item from the customer's cart
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.fishId
 * @returns {Promise<object>} Authoritative cart
 */
async function removeItem({ customerId, fishId }) {
  if (!customerId) {
    const err = new Error('CUSTOMER_ID_REQUIRED');
    err.code = 'CUSTOMER_ID_REQUIRED';
    throw err;
  }

  const cartMap = getCustomerMap(customerId);
  cartMap.delete(fishId);

  return getCart(customerId);
}

/**
 * Clear all items from customer's cart
 * @param {string} customerId
 * @returns {Promise<object>} Empty cart
 */
async function clearCart(customerId) {
  if (!customerId) {
    const err = new Error('CUSTOMER_ID_REQUIRED');
    err.code = 'CUSTOMER_ID_REQUIRED';
    throw err;
  }

  const cartMap = getCustomerMap(customerId);
  cartMap.clear();

  return getCart(customerId);
}

module.exports = {
  name: 'CartEngine',
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};
