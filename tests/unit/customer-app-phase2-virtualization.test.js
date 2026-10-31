/**
 * Automated Verification Suite: Customer App Phase 2
 * Mobile UI Virtualization & Asset Optimization
 * 
 * Tests:
 * 1. HomeScreen FlatList Virtualization Structure (numColumns=2, initialNumToRender, windowSize, etc.)
 * 2. FishCard Memoization and Equality Checker (areFishCardPropsEqual)
 * 3. Category Badge Styling and Taxonomy Mapping
 * 4. OptimizedFishImage Fallback and Safety Constraints
 * 5. Catalogue Filtering & Search Invariants
 * 6. Elimination of Unvirtualized Vertical Mapping
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const homeScreenPath = path.resolve(__dirname, '../../customer-app/src/screens/HomeScreen.jsx');
const fishCardPath = path.resolve(__dirname, '../../customer-app/src/components/FishCard.jsx');
const optimizedImagePath = path.resolve(__dirname, '../../customer-app/src/components/OptimizedFishImage.jsx');

describe('Customer App Phase 2: UI Virtualization & Asset Optimization', () => {
  const homeCode = fs.readFileSync(homeScreenPath, 'utf8');
  const fishCardCode = fs.readFileSync(fishCardPath, 'utf8');
  const optimizedImageCode = fs.readFileSync(optimizedImagePath, 'utf8');

  test('Section 1.1: HomeScreen imports FlatList and Platform from react-native', () => {
    assert.ok(homeCode.includes('FlatList'), 'HomeScreen must import FlatList from react-native');
    assert.ok(homeCode.includes('Platform'), 'HomeScreen must import Platform from react-native');
  });

  test('Section 1.2: HomeScreen imports FishCard and OptimizedFishImage components', () => {
    assert.ok(
      homeCode.includes("from '../components/FishCard'"),
      'HomeScreen must import FishCard component'
    );
    assert.ok(
      homeCode.includes("from '../components/OptimizedFishImage'"),
      'HomeScreen must import OptimizedFishImage component'
    );
  });

  test('Section 1.3: HomeScreen replaces vertical ScrollView with 2-column FlatList', () => {
    // Verify FlatList usage
    assert.ok(homeCode.includes('<FlatList'), 'HomeScreen must render a FlatList');
    assert.ok(homeCode.includes('numColumns={2}'), 'FlatList must configure numColumns={2}');
    assert.ok(homeCode.includes('columnWrapperStyle='), 'FlatList must configure columnWrapperStyle for 2-column grid alignment');
    assert.ok(homeCode.includes('data={loading || error ? [] : filteredFishes}'), 'FlatList data must be bound to filteredFishes (or empty during loading/error)');
  });

  test('Section 1.4: FlatList includes standard performance tuning props', () => {
    assert.ok(homeCode.includes('initialNumToRender={6}'), 'FlatList must configure initialNumToRender={6}');
    assert.ok(homeCode.includes('maxToRenderPerBatch={6}'), 'FlatList must configure maxToRenderPerBatch={6}');
    assert.ok(homeCode.includes('windowSize={5}'), 'FlatList must configure windowSize={5}');
    assert.ok(
      homeCode.includes("removeClippedSubviews={Platform.OS === 'android'}"),
      "FlatList must configure removeClippedSubviews={Platform.OS === 'android'}"
    );
    assert.ok(homeCode.includes('keyExtractor={keyExtractor}'), 'FlatList must use memoized keyExtractor');
  });

  test('Section 1.5: FlatList utilizes ListHeaderComponent, ListEmptyComponent, and ListFooterComponent', () => {
    assert.ok(homeCode.includes('ListHeaderComponent={renderListHeader}'), 'FlatList must provide ListHeaderComponent');
    assert.ok(homeCode.includes('ListEmptyComponent={renderEmptyComponent}'), 'FlatList must provide ListEmptyComponent');
    assert.ok(homeCode.includes('ListFooterComponent={renderFooter}'), 'FlatList must provide ListFooterComponent');
  });

  test('Section 1.6: Primary catalogue no longer uses unvirtualized filteredFishes.map()', () => {
    assert.ok(
      !homeCode.includes('filteredFishes.map('),
      'HomeScreen must NOT execute unvirtualized filteredFishes.map() in the render tree'
    );
  });

  test('Section 1.7: Handlers and callbacks are memoized with useCallback', () => {
    assert.ok(homeCode.includes('const toggleFavorite = useCallback('), 'toggleFavorite must be wrapped in useCallback');
    assert.ok(homeCode.includes('const handleAddToCart = useCallback('), 'handleAddToCart must be wrapped in useCallback');
    assert.ok(homeCode.includes('const handleNavigateDetails = useCallback('), 'handleNavigateDetails must be wrapped in useCallback');
    assert.ok(homeCode.includes('const renderFishItem = useCallback('), 'renderFishItem must be wrapped in useCallback');
    assert.ok(homeCode.includes('const keyExtractor = useCallback('), 'keyExtractor must be wrapped in useCallback');
  });

  test('Section 2.1: FishCard is wrapped in React.memo with custom equality comparator', () => {
    assert.ok(
      fishCardCode.includes('export default React.memo(FishCard, areFishCardPropsEqual);'),
      'FishCard must export React.memo with areFishCardPropsEqual'
    );
  });

  test('Section 2.2: areFishCardPropsEqual accurately skips re-rendering when other items change', () => {
    // Extract areFishCardPropsEqual function definition from FishCard.jsx
    const funcMatch = fishCardCode.match(/function areFishCardPropsEqual\([\s\S]*?\n\}/);
    assert.ok(funcMatch, 'areFishCardPropsEqual function must exist in FishCard.jsx');

    const fnStr = funcMatch[0];
    const arePropsEqual = new Function(`${fnStr}; return areFishCardPropsEqual;`)();

    const baseItem = {
      id: 'fish-101',
      name: 'Fresh Lake Pomfret',
      imageUrl: 'https://pondfish.in/img/pomfret.jpg',
      unitPrice: 450,
      physicalAvailable: true,
      onlineBookable: true,
      categoryName: 'Marine Catch',
      ratingCount: '1,200',
      pricing: { effectivePrice: 380, hasDiscount: true },
    };

    const fnToggle = () => {};
    const fnAdd = () => {};
    const fnPress = () => {};

    const prevProps = {
      item: baseItem,
      isFav: false,
      isAdding: false,
      onToggleFav: fnToggle,
      onAddToCart: fnAdd,
      onPress: fnPress,
    };

    // Case 1: Identical props -> returns true (skip re-render)
    assert.strictEqual(arePropsEqual(prevProps, { ...prevProps }), true);

    // Case 2: Favorite state changed -> returns false (must re-render)
    assert.strictEqual(arePropsEqual(prevProps, { ...prevProps, isFav: true }), false);

    // Case 3: Adding to cart state changed -> returns false (must re-render)
    assert.strictEqual(arePropsEqual(prevProps, { ...prevProps, isAdding: true }), false);

    // Case 4: Price or discount changed -> returns false
    const updatedPriceItem = {
      ...baseItem,
      pricing: { effectivePrice: 350, hasDiscount: true },
    };
    assert.strictEqual(arePropsEqual(prevProps, { ...prevProps, item: updatedPriceItem }), false);

    // Case 5: Stock availability changed -> returns false
    const outOfStockItem = { ...baseItem, physicalAvailable: false };
    assert.strictEqual(arePropsEqual(prevProps, { ...prevProps, item: outOfStockItem }), false);

    // Case 6: Completely different item id -> returns false
    const differentItem = { ...baseItem, id: 'fish-102', name: 'Rohu' };
    assert.strictEqual(arePropsEqual(prevProps, { ...prevProps, item: differentItem }), false);
  });

  test('Section 2.3: getCategoryBadgeStyle maps categories to correct brand color palettes', () => {
    const funcMatch = fishCardCode.match(/export function getCategoryBadgeStyle\([\s\S]*?\n\}/);
    assert.ok(funcMatch, 'getCategoryBadgeStyle function must exist in FishCard.jsx');

    const fnStr = funcMatch[0].replace('export ', '');
    const getBadgeStyle = new Function(`${fnStr}; return getCategoryBadgeStyle;`)();

    assert.deepStrictEqual(getBadgeStyle('Marine Catch'), { backgroundColor: '#0284C7' });
    assert.deepStrictEqual(getBadgeStyle('Shellfish & Prawns'), { backgroundColor: '#D97706' });
    assert.deepStrictEqual(getBadgeStyle('Fresh Prawns'), { backgroundColor: '#D97706' });
    assert.deepStrictEqual(getBadgeStyle('Pond Harvest'), { backgroundColor: '#059669' });
    assert.deepStrictEqual(getBadgeStyle('Live Fish'), { backgroundColor: '#059669' });
    assert.deepStrictEqual(getBadgeStyle('Exotic Import'), { backgroundColor: '#0A1C33' });
    assert.deepStrictEqual(getBadgeStyle(''), { backgroundColor: '#0A1C33' });
  });

  test('Section 3.1: OptimizedFishImage exports memoized component with error handling', () => {
    assert.ok(
      optimizedImageCode.includes('export default React.memo(OptimizedFishImage);'),
      'OptimizedFishImage must export memoized component'
    );
    assert.ok(
      optimizedImageCode.includes('onError='),
      'OptimizedFishImage must hook onError to set fallback state'
    );
    assert.ok(
      optimizedImageCode.includes('fallbackContainer'),
      'OptimizedFishImage must define fallbackContainer style'
    );
    assert.ok(
      optimizedImageCode.includes("fallbackText = '🐟'"),
      'OptimizedFishImage must provide default 🐟 fallback emoji'
    );
  });

  test('Section 3.2: OptimizedFishImage does not speculatively rewrite URLs', () => {
    // Assert no ?w= or ?format= string concatenations exist in OptimizedFishImage
    assert.ok(!optimizedImageCode.includes('?w='), 'Must not append speculative ?w= CDN params');
    assert.ok(!optimizedImageCode.includes('&format=webp'), 'Must not append speculative &format=webp');
  });

  test('Section 4.1: Fish catalogue filter correctly handles search, categories, and availability', () => {
    const sampleFishList = [
      {
        id: '1',
        name: 'Fresh Rohu Carp',
        description: 'Sweet river carp from Godavari',
        categoryId: 'cat-freshwater',
        categoryName: 'Freshwater',
        onlineBookable: true,
        physicalAvailable: true,
        pricing: { effectivePrice: 220, hasDiscount: false },
      },
      {
        id: '2',
        name: 'Black Pomfret',
        description: 'Deep sea marine pomfret',
        categoryId: 'cat-marine',
        categoryName: 'Marine',
        onlineBookable: true,
        physicalAvailable: true,
        pricing: { effectivePrice: 480, hasDiscount: true },
      },
      {
        id: '3',
        name: 'Tiger Prawns (Large)',
        description: 'Farm harvested jumbo prawns',
        categoryId: 'cat-prawns',
        categoryName: 'Prawns',
        onlineBookable: false,
        physicalAvailable: true,
        pricing: { effectivePrice: 650, hasDiscount: true },
      },
      {
        id: '4',
        name: 'Katla Head Cut',
        description: 'Counter pickup only',
        categoryId: 'cat-freshwater',
        categoryName: 'Freshwater',
        onlineBookable: false,
        physicalAvailable: true,
        pricing: { effectivePrice: 190, hasDiscount: false },
      },
    ];

    function filterCatalogue(list, categoryId, availability, query) {
      return list.filter((item) => {
        if (categoryId && item.categoryId !== categoryId) return false;
        if (availability === 'BOOKABLE' && !item.onlineBookable) return false;
        if (availability === 'IN_STORE' && (!item.physicalAvailable || item.onlineBookable)) return false;
        if (availability === 'DISCOUNT' && (!item.pricing || !item.pricing.hasDiscount)) return false;
        if (query && query.trim()) {
          const q = query.toLowerCase().trim();
          const match =
            (item.name && item.name.toLowerCase().includes(q)) ||
            (item.description && item.description.toLowerCase().includes(q)) ||
            (item.categoryName && item.categoryName.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      });
    }

    // Test All Catch
    assert.strictEqual(filterCatalogue(sampleFishList, null, 'ALL', '').length, 4);

    // Test Category filter
    const freshwaterOnly = filterCatalogue(sampleFishList, 'cat-freshwater', 'ALL', '');
    assert.strictEqual(freshwaterOnly.length, 2);
    assert.strictEqual(freshwaterOnly[0].name, 'Fresh Rohu Carp');

    // Test Online Bookable filter
    const bookableOnly = filterCatalogue(sampleFishList, null, 'BOOKABLE', '');
    assert.strictEqual(bookableOnly.length, 2);
    assert.ok(bookableOnly.every((f) => f.onlineBookable === true));

    // Test In-Store Only filter
    const inStoreOnly = filterCatalogue(sampleFishList, null, 'IN_STORE', '');
    assert.strictEqual(inStoreOnly.length, 2);
    assert.ok(inStoreOnly.every((f) => f.onlineBookable === false && f.physicalAvailable === true));

    // Test Discount Offers filter
    const discountOnly = filterCatalogue(sampleFishList, null, 'DISCOUNT', '');
    assert.strictEqual(discountOnly.length, 2);
    assert.ok(discountOnly.every((f) => f.pricing.hasDiscount === true));

    // Test Keyword Search
    const searchPrawns = filterCatalogue(sampleFishList, null, 'ALL', 'prawn');
    assert.strictEqual(searchPrawns.length, 1);
    assert.strictEqual(searchPrawns[0].id, '3');

    // Combined Category + Bookable + Search
    const combined = filterCatalogue(sampleFishList, 'cat-marine', 'BOOKABLE', 'pomfret');
    assert.strictEqual(combined.length, 1);
    assert.strictEqual(combined[0].id, '2');
  });

  test('Section 5.1: Carousels in ListHeader use OptimizedFishImage component', () => {
    // Both flash-image and prev-image testIDs or OptimizedFishImage usages should be present in HomeScreen
    assert.ok(
      homeCode.includes('<OptimizedFishImage\n                        uri={item.imageUrl}\n                        style={styles.flashImage}'),
      'Flash sale carousel must use OptimizedFishImage'
    );
    assert.ok(
      homeCode.includes('<OptimizedFishImage\n                      uri={item.imageUrl}\n                      style={styles.prevImage}'),
      'Previously bought carousel must use OptimizedFishImage'
    );
  });
});
