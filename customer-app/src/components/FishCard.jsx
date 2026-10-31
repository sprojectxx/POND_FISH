import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import OptimizedFishImage from './OptimizedFishImage';

/**
 * Category badge style helper based on category taxonomy
 */
export function getCategoryBadgeStyle(categoryName = '') {
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('marine')) return { backgroundColor: '#0284C7' };
  if (cat.includes('shell') || cat.includes('prawn')) return { backgroundColor: '#D97706' };
  if (cat.includes('pond') || cat.includes('live')) return { backgroundColor: '#059669' };
  return { backgroundColor: '#0A1C33' };
}

/**
 * FishCard
 * 
 * Standalone, memoized primary catalogue card.
 * Encapsulates pricing, availability, favorite toggles, and detail navigation.
 */
function FishCard({
  item,
  isFav = false,
  isAdding = false,
  onToggleFav,
  onAddToCart,
  onPress,
}) {
  if (!item) return null;

  const isAvailable = Boolean(item.physicalAvailable);
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

  return (
    <View style={styles.gridFishCard} testID={`fish-card-${item.id}`}>
      {/* Card Header: Category & Heart */}
      <View style={styles.gridCardHeader}>
        <View style={[styles.gridCatBadge, getCategoryBadgeStyle(item.categoryName)]}>
          <Text style={styles.gridCatBadgeText}>{item.categoryName || 'Freshwater'}</Text>
        </View>
        <TouchableOpacity
          onPress={handleToggleFavPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={`fav-btn-${item.id}`}
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
        activeOpacity={0.88}
        testID={`image-touch-${item.id}`}
      >
        <OptimizedFishImage
          uri={item.imageUrl}
          style={styles.gridFishImage}
          resizeMode="cover"
          testID={`fish-image-${item.id}`}
        />
      </TouchableOpacity>

      {/* Carousel Dots */}
      <View style={styles.carouselDotsRow}>
        <View style={[styles.cDot, styles.cDotActive]} />
        <View style={styles.cDot} />
        <View style={styles.cDot} />
      </View>

      {/* Weight & ADD Button Row */}
      <View style={styles.gridMetaRow}>
        <Text style={styles.gridWeightText}>500 g</Text>
        <TouchableOpacity
          style={styles.gridAddBtn}
          onPress={handleAddToCartPress}
          disabled={isAdding || !isAvailable}
          activeOpacity={0.8}
          testID={`add-btn-${item.id}`}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#16A34A" />
          ) : (
            <Text style={styles.gridAddBtnText}>+ ADD</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Pricing Row */}
      <View style={styles.gridPricingRow}>
        <Text style={styles.gridPriceVal}>₹{effectivePrice}</Text>
        {hasDiscount && (
          <Text style={styles.gridCrossedPrice}>₹{item.unitPrice}</Text>
        )}
      </View>

      {/* Fish Title */}
      <TouchableOpacity onPress={handleCardPress}>
        <Text style={styles.gridFishName} numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>

      {/* Rating */}
      <View style={styles.gridRatingRow}>
        <Text style={styles.gridRatingStar}>★ 4.8</Text>
        <Text style={styles.gridRatingCount}>({item.ratingCount || '1,420'})</Text>
      </View>

      {/* Delivery & Stock status */}
      <View style={styles.gridDeliveryRow}>
        <Text style={styles.gridDeliveryText}>⚡ 8 mins • </Text>
        <Text style={isAvailable ? styles.inStockText : styles.lowStockText}>
          {isAvailable ? 'In stock' : 'Out of stock'}
        </Text>
      </View>

      {/* Category Footer Link */}
      <Text style={styles.gridCategoryLink}>{item.categoryName || 'Freshwater'} ›</Text>
    </View>
  );
}

function areFishCardPropsEqual(prevProps, nextProps) {
  if (prevProps.isFav !== nextProps.isFav) return false;
  if (prevProps.isAdding !== nextProps.isAdding) return false;
  if (prevProps.onToggleFav !== nextProps.onToggleFav) return false;
  if (prevProps.onAddToCart !== nextProps.onAddToCart) return false;
  if (prevProps.onPress !== nextProps.onPress) return false;

  const prevItem = prevProps.item;
  const nextItem = nextProps.item;
  if (prevItem === nextItem) return true;
  if (!prevItem || !nextItem) return false;

  return (
    prevItem.id === nextItem.id &&
    prevItem.name === nextItem.name &&
    prevItem.imageUrl === nextItem.imageUrl &&
    prevItem.unitPrice === nextItem.unitPrice &&
    prevItem.physicalAvailable === nextItem.physicalAvailable &&
    prevItem.onlineBookable === nextItem.onlineBookable &&
    prevItem.categoryName === nextItem.categoryName &&
    prevItem.ratingCount === nextItem.ratingCount &&
    prevItem.pricing?.effectivePrice === nextItem.pricing?.effectivePrice &&
    prevItem.pricing?.hasDiscount === nextItem.pricing?.hasDiscount
  );
}

const styles = StyleSheet.create({
  gridFishCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 10,
    shadowColor: '#0A1C33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridCatBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  gridCatBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heartIcon: {
    fontSize: 16,
    color: '#94A3B8',
  },
  heartActive: {
    color: '#EF4444',
  },
  gridImageBox: {
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  gridFishImage: {
    width: '100%',
    height: '100%',
  },
  carouselDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginVertical: 4,
  },
  cDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  cDotActive: {
    backgroundColor: '#0284C7',
    width: 10,
  },
  gridMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  gridWeightText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  gridAddBtn: {
    borderWidth: 1.5,
    borderColor: '#16A34A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  gridAddBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  gridPricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 2,
  },
  gridPriceVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1C33',
  },
  gridCrossedPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  gridFishName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1C33',
    lineHeight: 16,
    marginBottom: 4,
    minHeight: 32,
  },
  gridRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 3,
  },
  gridRatingStar: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '700',
  },
  gridRatingCount: {
    fontSize: 10,
    color: '#94A3B8',
  },
  gridDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  gridDeliveryText: {
    fontSize: 10,
    color: '#64748B',
  },
  inStockText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '700',
  },
  lowStockText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '700',
  },
  gridCategoryLink: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
});

export default React.memo(FishCard, areFishCardPropsEqual);
