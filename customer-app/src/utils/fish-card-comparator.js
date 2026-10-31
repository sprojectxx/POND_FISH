/**
 * FishCard Custom Equality Comparator
 * 
 * Determines whether a memoized FishCard should re-render based on shallow equality
 * of callbacks, active selection states, and relevant item data fields.
 */
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

module.exports = {
  areFishCardPropsEqual,
};
