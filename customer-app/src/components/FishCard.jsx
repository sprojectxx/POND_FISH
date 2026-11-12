import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import OptimizedFishImage from './OptimizedFishImage';
import { areFishCardPropsEqual } from '../utils/fish-card-comparator';
import { PlusIcon, MinusIcon } from './icons/NavIcons';

export { areFishCardPropsEqual };

/**
 * FishCard
 * 
 * Professional commerce-standard fish catalogue card:
 * Pure white card, 0-24H FRESH badge, flashy red strikethrough discount,
 * bilingual typography, mint cold-chain tag, and solid navy CTA.
 * (No heart icon, no AI gear icons).
 */
function FishCard({
  item,
  isAdding = false,
  cartQuantity = 0,
  quantityInCart = 0,
  onAddToCart,
  onPress,
  onIncrement,
  onDecrement,
}) {
  if (!item) return null;

  const qty = cartQuantity || quantityInCart || 0;
  const isPhysicalAvailable = item.physicalAvailable !== false;
  const effectivePrice = item.pricing ? item.pricing.effectivePrice : item.unitPrice;
  const hasDiscount = Boolean(item.pricing && item.pricing.hasDiscount);
  const originalPrice = item.pricing ? item.pricing.basePrice : item.unitPrice;
  const savings = originalPrice - effectivePrice;
  const discountPercent = item.pricing?.discount?.value || Math.round((savings / originalPrice) * 100);

  const handleCardPress = () => {
    if (onPress) onPress(item);
  };

  const handleAddToCartPress = () => {
    if (onAddToCart) onAddToCart(item);
  };

  const handleIncrementPress = () => {
    if (onIncrement) {
      onIncrement(item);
    } else if (onAddToCart) {
      onAddToCart(item);
    }
  };

  const handleDecrementPress = () => {
    if (onDecrement) onDecrement(item);
  };

  return (
    <View style={styles.gridFishCard} testID={`fish-card-${item.id}`}>
      {/* Product Image Box - Pure White without gray box */}
      <TouchableOpacity
        onPress={handleCardPress}
        style={styles.gridImageBox}
        activeOpacity={0.92}
        testID={`image-touch-${item.id}`}
        accessibilityRole="imagebutton"
        accessibilityLabel={`View details for ${item.name}`}
      >
        <OptimizedFishImage
          uri={item.imageUrl}
          style={styles.gridFishImage}
          resizeMode="contain"
          testID={`fish-image-${item.id}`}
        />



        {/* Flashy Red Offer Badge (Flush Top-Left) */}
        {hasDiscount && (
          <View style={styles.offerBadge}>
            <Text style={styles.offerBadgeText}>
              <Text style={styles.offerBadgePercent}>{discountPercent}%</Text> OFF
            </Text>
          </View>
        )}

        {!isPhysicalAvailable && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockOverlayText}>Sold Out</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Fish Title & Regional Name (Clean, No Heart Icon) */}
      <TouchableOpacity
        onPress={handleCardPress}
        activeOpacity={0.85}
        style={styles.titleContainer}
      >
        <Text style={styles.gridFishName} numberOfLines={1}>
          {item.name}
        </Text>
        {Boolean(item.teluguName || item.regionalName) && (
          <Text style={styles.gridRegionalName} numberOfLines={1}>
            {item.teluguName || item.regionalName}
          </Text>
        )}
      </TouchableOpacity>

      {/* Cold Chain Freshness Pill */}
      <View style={styles.coldChainPill}>
        <View style={styles.coldChainDot} />
        <Text style={styles.coldChainText}>0-24h Cold Chain Fresh</Text>
      </View>

      {/* Pricing & Solid Action Button */}
      <View style={styles.actionRow}>
        <View style={styles.pricingBox}>
          {/* Main Effective Price */}
          <View style={styles.priceLine}>
            <Text style={styles.priceVal}>₹{effectivePrice}</Text>
            <Text style={styles.priceUnit}> / KG</Text>
          </View>

          {/* Flashy Red Strikethrough & Green Savings Tag */}
          {hasDiscount && (
            <View style={styles.discountRow}>
              <View style={styles.strikeContainer}>
                <Text style={styles.originalPriceText}>₹{originalPrice}</Text>
                <View style={styles.redStrikeLine} />
              </View>
              <View style={styles.savingsPill}>
                <Text style={styles.savingsPillText}>Save ₹{savings}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Stepper or Solid Navy Button */}
        {qty > 0 ? (
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              onPress={handleDecrementPress}
              style={styles.stepperBtn}
              accessibilityLabel="Decrease quantity"
            >
              <MinusIcon size={12} color="#0A1C33" />
            </TouchableOpacity>
            <View style={styles.stepperQtyBox}>
              <Text style={styles.stepperQtyText}>{qty}</Text>
            </View>
            <TouchableOpacity
              onPress={handleIncrementPress}
              style={styles.stepperBtn}
              accessibilityLabel="Increase quantity"
            >
              <PlusIcon size={12} color="#0A1C33" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleAddToCartPress}
            disabled={!isPhysicalAvailable || isAdding}
            style={[
              styles.gridAddBtn,
              !isPhysicalAvailable && styles.gridAddBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to cart`}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.gridAddBtnText,
                  !isPhysicalAvailable && styles.gridAddBtnTextDisabled,
                ]}
              >
                {!isPhysicalAvailable ? 'SOLD' : '+ ADD'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gridFishCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginHorizontal: 4,
    marginBottom: 12,
    shadowColor: '#0A1C33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  gridImageBox: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  gridFishImage: {
    width: '100%',
    height: '100%',
  },
  freshBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    zIndex: 2,
  },
  freshBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  offerBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#D90429',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 12,
    zIndex: 4,
    shadowColor: '#D90429',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  offerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  offerBadgePercent: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 28, 51, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  titleContainer: {
    minHeight: 38,
    justifyContent: 'center',
    marginBottom: 4,
  },
  gridFishName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F2C59',
    lineHeight: 17,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  gridRegionalName: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  coldChainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F8F0',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    marginBottom: 8,
  },
  coldChainDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0D824D',
    marginRight: 4,
  },
  coldChainText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0D824D',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pricingBox: {
    flexDirection: 'column',
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: -0.2,
  },
  priceUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  strikeContainer: {
    position: 'relative',
    marginRight: 6,
  },
  originalPriceText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  redStrikeLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: '#DC2626',
  },
  savingsPill: {
    backgroundColor: '#E6F8F0',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  savingsPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0D824D',
  },
  gridAddBtn: {
    backgroundColor: '#0F294A',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F294A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  gridAddBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  gridAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  gridAddBtnTextDisabled: {
    color: '#64748B',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 28,
  },
  stepperBtn: {
    paddingHorizontal: 6,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyBox: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1C33',
  },
});

export default React.memo(FishCard, areFishCardPropsEqual);
