import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import OptimizedFishImage from './OptimizedFishImage';
import { getCategoryBadgeStyle } from '../utils/catalogue-filters';
import { areFishCardPropsEqual } from '../utils/fish-card-comparator';
import { Colors, Typography, Spacing, Radii, Shadows } from '../theme/tokens';
import { PlusIcon, MinusIcon } from './icons/NavIcons';

export { getCategoryBadgeStyle, areFishCardPropsEqual };

/**
 * FishCard
 * 
 * Standalone, memoized primary catalogue card designed to tier-1 commerce standards.
 * Responsive 2-column layout, verified inventory status, authentic pricing,
 * and inline quantity stepper.
 */
function FishCard({
  item,
  isFav = false,
  isAdding = false,
  cartQuantity = 0,
  quantityInCart = 0,
  onToggleFav,
  onAddToCart,
  onPress,
  onIncrement,
  onDecrement,
}) {
  if (!item) return null;

  const qty = cartQuantity || quantityInCart || 0;
  const isPhysicalAvailable = Boolean(item.physicalAvailable);
  const isOnlineBookable = Boolean(item.onlineBookable);
  const effectivePrice = item.pricing ? item.pricing.effectivePrice : item.unitPrice;
  const hasDiscount = Boolean(item.pricing && item.pricing.hasDiscount);

  const handleCardPress = () => {
    if (onPress) {
      onPress(item);
    }
  };

  const handleToggleFavPress = () => {
    if (onToggleFav) {
      onToggleFav(item.id);
    }
  };

  const handleAddToCartPress = () => {
    if (onAddToCart) {
      onAddToCart(item);
    }
  };

  const handleIncrementPress = () => {
    if (onIncrement) {
      onIncrement(item);
    } else if (onAddToCart) {
      onAddToCart(item);
    }
  };

  const handleDecrementPress = () => {
    if (onDecrement) {
      onDecrement(item);
    }
  };

  return (
    <View style={styles.gridFishCard} testID={`fish-card-${item.id}`}>
      {/* Card Header: Category Tag & Favorite Button */}
      <View style={styles.gridCardHeader}>
        {Boolean(item.categoryName) ? (
          <View style={[styles.gridCatBadge, getCategoryBadgeStyle(item.categoryName)]}>
            <Text style={styles.gridCatBadgeText}>{item.categoryName}</Text>
          </View>
        ) : (
          <View style={styles.emptyCatPlaceholder} />
        )}
        <TouchableOpacity
          onPress={handleToggleFavPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.heartTouchTarget}
          testID={`fav-btn-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Text style={[styles.heartIcon, isFav && styles.heartActive]}>
            {isFav ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Product Image */}
      <TouchableOpacity
        onPress={handleCardPress}
        style={styles.gridImageBox}
        activeOpacity={0.9}
        testID={`image-touch-${item.id}`}
        accessibilityRole="imagebutton"
        accessibilityLabel={`View details for ${item.name}`}
      >
        <OptimizedFishImage
          uri={item.imageUrl}
          style={styles.gridFishImage}
          resizeMode="cover"
          testID={`fish-image-${item.id}`}
        />
        {!isPhysicalAvailable && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockOverlayText}>Sold Out</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Fish Title & Verified Unit/Weight */}
      <TouchableOpacity
        onPress={handleCardPress}
        activeOpacity={0.85}
        style={styles.titleContainer}
      >
        <Text style={styles.gridFishName} numberOfLines={2}>
          {item.name}
        </Text>
        {Boolean(item.unitBasis) && (
          <Text style={styles.gridWeightText}>
            {item.unitBasis}
          </Text>
        )}
      </TouchableOpacity>

      {/* Verified Status Row */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            isPhysicalAvailable ? styles.statusDotActive : styles.statusDotInactive,
          ]}
        />
        <Text style={isPhysicalAvailable ? styles.inStockText : styles.lowStockText}>
          {!isPhysicalAvailable
            ? 'Sold Out'
            : !isOnlineBookable
            ? 'In-Store Counter Only'
            : 'Available at Counter'}
        </Text>
      </View>

      {/* Pricing & ADD / Stepper Row */}
      <View style={styles.actionRow}>
        <View style={styles.gridPricingBox}>
          <Text style={styles.gridPriceVal}>₹{effectivePrice}</Text>
          {hasDiscount && (
            <Text style={styles.gridCrossedPrice}>₹{item.unitPrice}</Text>
          )}
        </View>

        {/* Action Button: Stepper or ADD */}
        {qty > 0 && isPhysicalAvailable && isOnlineBookable ? (
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={handleDecrementPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isAdding}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
            >
              <MinusIcon size={12} color={Colors.actionGreen} />
            </TouchableOpacity>

            <View style={styles.stepperQtyBox}>
              {isAdding ? (
                <ActivityIndicator size="small" color={Colors.actionGreen} />
              ) : (
                <Text style={styles.stepperQtyText}>{qty}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={handleIncrementPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isAdding || !isPhysicalAvailable}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <PlusIcon size={12} color={Colors.actionGreen} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.gridAddBtn,
              !isPhysicalAvailable && styles.gridAddBtnDisabled,
              isPhysicalAvailable && !isOnlineBookable && styles.gridInStoreBtn,
            ]}
            onPress={handleAddToCartPress}
            disabled={isAdding || !isPhysicalAvailable}
            activeOpacity={0.8}
            testID={`add-btn-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={
              !isPhysicalAvailable
                ? `${item.name} is sold out`
                : !isOnlineBookable
                ? `${item.name} available in-store only`
                : `Add ${item.name} to cart`
            }
          >
            {isAdding ? (
              <ActivityIndicator size="small" color={Colors.actionGreen} />
            ) : (
              <Text
                style={[
                  styles.gridAddBtnText,
                  !isPhysicalAvailable && styles.gridAddBtnTextDisabled,
                  isPhysicalAvailable && !isOnlineBookable && styles.gridInStoreBtnText,
                ]}
              >
                {!isPhysicalAvailable ? 'SOLD' : !isOnlineBookable ? 'IN STORE' : '+ ADD'}
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
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.sm,
    marginHorizontal: 4,
    marginBottom: 10,
    ...Shadows.card,
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    minHeight: 18,
  },
  emptyCatPlaceholder: {
    width: 1,
  },
  gridCatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.xs,
  },
  gridCatBadgeText: {
    color: Colors.textWhite,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  heartTouchTarget: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  heartActive: {
    color: Colors.error,
  },
  gridImageBox: {
    width: '100%',
    aspectRatio: 1.25,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  gridFishImage: {
    width: '100%',
    height: '100%',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 32, 59, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockOverlayText: {
    color: Colors.textWhite,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  titleContainer: {
    minHeight: 46,
    justifyContent: 'flex-start',
  },
  gridFishName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.brandNavy,
    lineHeight: 18,
    fontSize: 13,
  },
  gridWeightText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusDotActive: {
    backgroundColor: Colors.actionGreen,
  },
  statusDotInactive: {
    backgroundColor: Colors.textMuted,
  },
  inStockText: {
    fontSize: 10,
    color: Colors.actionGreen,
    fontWeight: '600',
  },
  lowStockText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  gridPricingBox: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  gridPriceVal: {
    ...Typography.price,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.brandNavy,
  },
  gridCrossedPrice: {
    fontSize: 10,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: -2,
  },
  gridAddBtn: {
    borderWidth: 1.5,
    borderColor: Colors.actionGreen,
    backgroundColor: Colors.actionGreenSubtle,
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 30,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridAddBtnDisabled: {
    borderColor: Colors.borderMedium,
    backgroundColor: Colors.surfaceSubtle,
  },
  gridInStoreBtn: {
    borderColor: Colors.brandBlue,
    backgroundColor: Colors.brandBlueSubtle,
  },
  gridAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.actionGreen,
    letterSpacing: 0.2,
  },
  gridAddBtnTextDisabled: {
    color: Colors.textMuted,
  },
  gridInStoreBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.brandBlue,
    letterSpacing: 0.2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.actionGreenSubtle,
    borderWidth: 1.5,
    borderColor: Colors.actionGreen,
    borderRadius: Radii.sm,
    minHeight: 30,
    paddingHorizontal: 2,
  },
  stepperBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
  },
  stepperQtyBox: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  stepperQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.actionGreen,
  },
});

export default React.memo(FishCard, areFishCardPropsEqual);
