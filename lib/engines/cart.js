/**
 * Engine 09: Cart & Checkout Calculation Business Engine
 * Traceability: PondFish Core Business Engines Spec (Section 13) & API Spec (Section 13)
 * Persistent domain module for customer cart validation, pricing calculation,
 * and online-booking eligibility enforcement backed by PostgreSQL (customer_cart_items).
 */

const fishRepository = require('../db/repositories/fishRepository');
const discountRepository = require('../db/repositories/discountRepository');
const cartRepository = require('../db/repositories/cartRepository');

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
 * Retrieve authoritative customer cart with live pricing and eligibility revalidation
 * Backed by persistent customer_cart_items PostgreSQL table.
 * @param {string} customerId
 * @returns {Promise<{ items: Array, summary: object }>}
 */
async function getCart(customerId) {
  if (!customerId) {
    const err = new Error('CUSTOMER_ID_REQUIRED');
    err.code = 'CUSTOMER_ID_REQUIRED';
    throw err;
  }

  const cartRows = await cartRepository.getCartItems(customerId);
  const activeDiscounts = await discountRepository.listActivePublicDiscounts().catch(() => []);

  const items = [];
  let totalQuantity = 0;
  let totalAmount = 0;
  let isAllBookable = true;

  for (const row of cartRows) {
    const fish = await fishRepository.findFishById(row.fish_id);

    if (!fish) {
      // Fish was deleted from database; clean up orphaned cart row
      await cartRepository.removeCartItem(customerId, row.fish_id).catch(() => {});
      continue;
    }

    const pricing = calculateEffectivePrice(fish.unit_price, activeDiscounts, fish.id);
    const subtotal = parseFloat((row.quantity_kg * pricing.effectivePrice).toFixed(2));
    const isAvailable = Boolean(fish.physical_available);
    const isOnlineBookable = Boolean(fish.online_bookable);

    if (!isAvailable || !isOnlineBookable) {
      isAllBookable = false;
    }

    totalQuantity += row.quantity_kg;
    totalAmount += subtotal;

    items.push({
      fishId: fish.id,
      name: fish.name,
      description: fish.description,
      imageUrl: fish.image_url,
      categoryName: fish.category_name,
      quantity: row.quantity_kg,
      unitPrice: fish.unit_price,
      effectivePrice: pricing.effectivePrice,
      hasDiscount: pricing.hasDiscount,
      discount: pricing.discount,
      subtotal,
      physicalAvailable: isAvailable,
      onlineBookable: isOnlineBookable,
      availabilityWarning: !isAvailable ? 'This fish is currently out of stock.' : null,
      bookingWarning: !isOnlineBookable ? 'This fish is no longer available for online booking.' : null,
      addedAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

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

  // Check current quantity in cart to enforce upper bound
  const existingItem = await cartRepository.getCartItem(customerId, fishId);
  const currentQty = existingItem ? existingItem.quantity_kg : 0;
  const newTotalQty = parseFloat((currentQty + parsedQty).toFixed(2));

  if (newTotalQty > 100) {
    const err = new Error('QUANTITY_EXCEEDS_LIMIT');
    err.code = 'QUANTITY_EXCEEDS_LIMIT';
    throw err;
  }

  // Persist to PostgreSQL customer_cart_items
  await cartRepository.addOrIncrementItem(customerId, fishId, parsedQty);

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

  const existingItem = await cartRepository.getCartItem(customerId, fishId);
  if (!existingItem) {
    const err = new Error('CART_ITEM_NOT_FOUND');
    err.code = 'CART_ITEM_NOT_FOUND';
    throw err;
  }

  // If quantity reduced to 0, remove item from database
  if (parsedQty === 0) {
    await cartRepository.removeCartItem(customerId, fishId);
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

  // Persist updated quantity to PostgreSQL
  await cartRepository.updateItemQuantity(customerId, fishId, parsedQty);

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

  if (!isValidUuid(fishId)) {
    const err = new Error('INVALID_FISH_ID');
    err.code = 'INVALID_FISH_ID';
    throw err;
  }

  await cartRepository.removeCartItem(customerId, fishId);

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

  await cartRepository.clearCart(customerId);

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
