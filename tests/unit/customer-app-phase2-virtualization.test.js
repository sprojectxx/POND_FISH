/**
 * Automated Verification Suite: Customer App Phase 2
 * Mobile UI Virtualization & Asset Optimization
 * 
 * Test Coverage Structure:
 * Suite 1: [Static Source Checks] HomeScreen FlatList Structure & Optimization Invariants
 * Suite 2: [Production Unit Tests] Production Catalogue Filtering Helper (filterFishCatalogue)
 * Suite 3: [Production Unit Tests] FishCard Production Comparator (areFishCardPropsEqual) & Category Styling
 * Suite 4: [Production Unit Tests & Static Checks] OptimizedFishImage URI Validation & Safety Invariants
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Direct imports of pure production helpers
const {
  filterFishCatalogue,
  getCategoryBadgeStyle,
} = require('../../customer-app/src/utils/catalogue-filters');
const {
  areFishCardPropsEqual,
} = require('../../customer-app/src/utils/fish-card-comparator');
const {
  isValidImageUri,
} = require('../../customer-app/src/utils/image-validator');

// File paths for static source checks
const homeScreenPath = path.resolve(__dirname, '../../customer-app/src/screens/HomeScreen.jsx');
const fishCardPath = path.resolve(__dirname, '../../customer-app/src/components/FishCard.jsx');
const optimizedImagePath = path.resolve(__dirname, '../../customer-app/src/components/OptimizedFishImage.jsx');

describe('Customer App Phase 2 Verification Suite', () => {
  const homeCode = fs.readFileSync(homeScreenPath, 'utf8');
  const fishCardCode = fs.readFileSync(fishCardPath, 'utf8');
  const optimizedImageCode = fs.readFileSync(optimizedImagePath, 'utf8');

  // =========================================================================
  // SUITE 1: [Static Source Checks] HomeScreen FlatList Structure
  // =========================================================================
  describe('Suite 1: [Static Source Checks] HomeScreen FlatList Structure', () => {
    test('1.1: [Static Source Check] HomeScreen imports FlatList and Platform from react-native', () => {
      assert.ok(homeCode.includes('FlatList'), 'HomeScreen must import FlatList from react-native');
      assert.ok(homeCode.includes('Platform'), 'HomeScreen must import Platform from react-native');
    });

    test('1.2: [Static Source Check] HomeScreen imports FishCard, OptimizedFishImage, and production filter helper', () => {
      assert.ok(
        homeCode.includes("from '../components/FishCard'"),
        'HomeScreen must import FishCard component'
      );
      assert.ok(
        homeCode.includes("from '../components/OptimizedFishImage'"),
        'HomeScreen must import OptimizedFishImage component'
      );
      assert.ok(
        homeCode.includes("from '../utils/catalogue-filters'"),
        'HomeScreen must import filterFishCatalogue from utils'
      );
    });

    test('1.3: [Static Source Check] HomeScreen replaces vertical ScrollView with 2-column FlatList', () => {
      assert.ok(homeCode.includes('<FlatList'), 'HomeScreen must render a FlatList');
      assert.ok(homeCode.includes('numColumns={2}'), 'FlatList must configure numColumns={2}');
      assert.ok(homeCode.includes('columnWrapperStyle='), 'FlatList must configure columnWrapperStyle for 2-column grid alignment');
      assert.ok(homeCode.includes('data={loading || error ? [] : filteredFishes}'), 'FlatList data must be bound to filteredFishes');
    });

    test('1.4: [Static Source Check] FlatList includes standard performance tuning props', () => {
      assert.ok(homeCode.includes('initialNumToRender={6}'), 'FlatList must configure initialNumToRender={6}');
      assert.ok(homeCode.includes('maxToRenderPerBatch={6}'), 'FlatList must configure maxToRenderPerBatch={6}');
      assert.ok(homeCode.includes('windowSize={5}'), 'FlatList must configure windowSize={5}');
      assert.ok(
        homeCode.includes("removeClippedSubviews={Platform.OS === 'android'}"),
        "FlatList must configure removeClippedSubviews={Platform.OS === 'android'}"
      );
      assert.ok(homeCode.includes('keyExtractor={keyExtractor}'), 'FlatList must use memoized keyExtractor');
    });

    test('1.5: [Static Source Check] FlatList utilizes ListHeaderComponent, ListEmptyComponent, and ListFooterComponent', () => {
      assert.ok(homeCode.includes('ListHeaderComponent={renderListHeader}'), 'FlatList must provide ListHeaderComponent');
      assert.ok(homeCode.includes('ListEmptyComponent={renderEmptyComponent}'), 'FlatList must provide ListEmptyComponent');
      assert.ok(homeCode.includes('ListFooterComponent={renderFooter}'), 'FlatList must provide ListFooterComponent');
    });

    test('1.6: [Static Source Check] Primary catalogue no longer uses unvirtualized filteredFishes.map()', () => {
      assert.ok(
        !homeCode.includes('filteredFishes.map('),
        'HomeScreen must NOT execute unvirtualized filteredFishes.map() in the render tree'
      );
    });

    test('1.7: [Static Source Check] Handlers and callbacks are memoized with useCallback', () => {
      assert.ok(homeCode.includes('const toggleFavorite = useCallback('), 'toggleFavorite must be wrapped in useCallback');
      assert.ok(homeCode.includes('const handleAddToCart = useCallback('), 'handleAddToCart must be wrapped in useCallback');
      assert.ok(homeCode.includes('const handleNavigateDetails = useCallback('), 'handleNavigateDetails must be wrapped in useCallback');
      assert.ok(homeCode.includes('const renderFishItem = useCallback('), 'renderFishItem must be wrapped in useCallback');
      assert.ok(homeCode.includes('const keyExtractor = useCallback('), 'keyExtractor must be wrapped in useCallback');
    });

    test('1.8: [Static Source Check] Header subcomponents are isolated with React.memo', () => {
      assert.ok(homeCode.includes('const DashboardBanners = React.memo('), 'DashboardBanners must be memoized');
      assert.ok(homeCode.includes('const FlashSaleCarousel = React.memo('), 'FlashSaleCarousel must be memoized');
      assert.ok(homeCode.includes('const PreviouslyBoughtCarousel = React.memo('), 'PreviouslyBoughtCarousel must be memoized');
      assert.ok(homeCode.includes('const CatalogueHeaderControls = React.memo('), 'CatalogueHeaderControls must be memoized');
    });
  });

  // =========================================================================
  // SUITE 2: [Production Unit Tests] Catalogue Filtering Helper
  // =========================================================================
  describe('Suite 2: [Production Unit Tests] Production Catalogue Filtering Helper', () => {
    const sampleFishList = [
      {
        id: 'fish-1',
        name: 'Fresh Rohu Carp',
        description: 'Sweet river carp from Godavari basin',
        categoryId: 'cat-freshwater',
        categoryName: 'Freshwater',
        onlineBookable: true,
        physicalAvailable: true,
        pricing: { effectivePrice: 220, hasDiscount: false },
      },
      {
        id: 'fish-2',
        name: 'Black Pomfret',
        description: 'Deep sea marine pomfret, whole cleaned',
        categoryId: 'cat-marine',
        categoryName: 'Marine Catch',
        onlineBookable: true,
        physicalAvailable: true,
        pricing: { effectivePrice: 480, hasDiscount: true },
      },
      {
        id: 'fish-3',
        name: 'Tiger Prawns (Large)',
        description: 'Farm harvested jumbo prawns',
        categoryId: 'cat-prawns',
        categoryName: 'Shellfish & Prawns',
        onlineBookable: false,
        physicalAvailable: true,
        pricing: { effectivePrice: 650, hasDiscount: true },
      },
      {
        id: 'fish-4',
        name: 'Katla Head Cut',
        description: 'Counter pickup only fresh cut',
        categoryId: 'cat-freshwater',
        categoryName: 'Freshwater',
        onlineBookable: false,
        physicalAvailable: true,
        pricing: { effectivePrice: 190, hasDiscount: false },
      },
      {
        id: 'fish-5',
        name: 'Crab Whole Live',
        description: 'Live sea crab',
        categoryId: 'cat-prawns',
        categoryName: 'Shellfish & Prawns',
        onlineBookable: false,
        physicalAvailable: false,
        pricing: { effectivePrice: 400, hasDiscount: false },
      },
    ];

    test('2.1: [Unit Test] Returns all items when default filters applied', () => {
      const result = filterFishCatalogue(sampleFishList);
      assert.strictEqual(result.length, 5);
      assert.deepStrictEqual(result.map((f) => f.id), ['fish-1', 'fish-2', 'fish-3', 'fish-4', 'fish-5']);
    });

    test('2.2: [Unit Test] Category filter strictly returns matching categoryId', () => {
      const freshwater = filterFishCatalogue(sampleFishList, { categoryId: 'cat-freshwater' });
      assert.strictEqual(freshwater.length, 2);
      assert.ok(freshwater.every((f) => f.categoryId === 'cat-freshwater'));

      const marine = filterFishCatalogue(sampleFishList, { categoryId: 'cat-marine' });
      assert.strictEqual(marine.length, 1);
      assert.strictEqual(marine[0].id, 'fish-2');
    });

    test('2.3: [Unit Test] Availability BOOKABLE filter returns only onlineBookable items', () => {
      const bookable = filterFishCatalogue(sampleFishList, { availability: 'BOOKABLE' });
      assert.strictEqual(bookable.length, 2);
      assert.ok(bookable.every((f) => f.onlineBookable === true));
    });

    test('2.4: [Unit Test] Availability IN_STORE filter returns items available physically but not online', () => {
      const inStore = filterFishCatalogue(sampleFishList, { availability: 'IN_STORE' });
      assert.strictEqual(inStore.length, 2); // fish-3 and fish-4 (fish-5 is not physicalAvailable)
      assert.ok(inStore.every((f) => f.physicalAvailable === true && !f.onlineBookable));
      assert.strictEqual(inStore.some((f) => f.id === 'fish-5'), false, 'Out-of-stock items must not pass IN_STORE');
    });

    test('2.5: [Unit Test] Availability DISCOUNT filter returns only items with active discount pricing', () => {
      const discounted = filterFishCatalogue(sampleFishList, { availability: 'DISCOUNT' });
      assert.strictEqual(discounted.length, 2); // fish-2 and fish-3
      assert.ok(discounted.every((f) => f.pricing && f.pricing.hasDiscount === true));
    });

    test('2.6: [Unit Test] Search filter matches case-insensitively across name, description, and categoryName', () => {
      // By name
      const byName = filterFishCatalogue(sampleFishList, { searchQuery: 'pomfret' });
      assert.strictEqual(byName.length, 1);
      assert.strictEqual(byName[0].id, 'fish-2');

      // By description
      const byDesc = filterFishCatalogue(sampleFishList, { searchQuery: 'godavari' });
      assert.strictEqual(byDesc.length, 1);
      assert.strictEqual(byDesc[0].id, 'fish-1');

      // By category name
      const byCat = filterFishCatalogue(sampleFishList, { searchQuery: 'shellfish' });
      assert.strictEqual(byCat.length, 2); // fish-3 and fish-5
    });

    test('2.7: [Unit Test] Combined multi-criteria filters narrow results accurately', () => {
      const combined = filterFishCatalogue(sampleFishList, {
        categoryId: 'cat-prawns',
        availability: 'IN_STORE',
        searchQuery: 'jumbo',
      });
      assert.strictEqual(combined.length, 1);
      assert.strictEqual(combined[0].id, 'fish-3');
    });

    test('2.8: [Unit Test] Non-matching queries produce clean empty array', () => {
      const emptyResult = filterFishCatalogue(sampleFishList, { searchQuery: 'salmon' });
      assert.strictEqual(emptyResult.length, 0);
    });

    test('2.9: [Unit Test] Safely handles empty, null, or malformed input list', () => {
      assert.deepStrictEqual(filterFishCatalogue(null), []);
      assert.deepStrictEqual(filterFishCatalogue(undefined), []);
      assert.deepStrictEqual(filterFishCatalogue([]), []);
      assert.deepStrictEqual(filterFishCatalogue([null, undefined]), []);
    });
  });

  // =========================================================================
  // SUITE 3: [Production Unit Tests] FishCard Production Comparator & Styling
  // =========================================================================
  describe('Suite 3: [Production Unit Tests] FishCard Production Comparator & Styling', () => {
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

    const baseProps = {
      item: baseItem,
      isFav: false,
      isAdding: false,
      onToggleFav: fnToggle,
      onAddToCart: fnAdd,
      onPress: fnPress,
    };

    test('3.1: [Unit Test] areFishCardPropsEqual returns true for identical props & references', () => {
      assert.strictEqual(areFishCardPropsEqual(baseProps, baseProps), true);
    });

    test('3.2: [Unit Test] areFishCardPropsEqual returns true for shallow-cloned identical items', () => {
      const clonedProps = { ...baseProps, item: { ...baseItem, pricing: { ...baseItem.pricing } } };
      assert.strictEqual(areFishCardPropsEqual(baseProps, clonedProps), true);
    });

    test('3.3: [Unit Test] areFishCardPropsEqual returns false when isFav changes', () => {
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, isFav: true }), false);
    });

    test('3.4: [Unit Test] areFishCardPropsEqual returns false when isAdding changes', () => {
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, isAdding: true }), false);
    });

    test('3.5: [Unit Test] areFishCardPropsEqual returns false when callback references change', () => {
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, onToggleFav: () => {} }), false);
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, onAddToCart: () => {} }), false);
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, onPress: () => {} }), false);
    });

    test('3.6: [Unit Test] areFishCardPropsEqual returns false on changes to every item field used by FishCard', () => {
      // 1. id
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, id: 'fish-999' } }), false);
      // 2. name
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, name: 'Different Fish' } }), false);
      // 3. imageUrl
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, imageUrl: 'https://pondfish.in/img/new.jpg' } }), false);
      // 4. unitPrice
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, unitPrice: 500 } }), false);
      // 5. physicalAvailable
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, physicalAvailable: false } }), false);
      // 6. onlineBookable
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, onlineBookable: false } }), false);
      // 7. categoryName
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, categoryName: 'Pond' } }), false);
      // 8. ratingCount
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, ratingCount: '1,500' } }), false);
      // 9. pricing.effectivePrice
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, pricing: { ...baseItem.pricing, effectivePrice: 320 } } }), false);
      // 10. pricing.hasDiscount
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: { ...baseItem, pricing: { ...baseItem.pricing, hasDiscount: false } } }), false);
    });

    test('3.7: [Unit Test] areFishCardPropsEqual safely handles null or missing items', () => {
      assert.strictEqual(areFishCardPropsEqual(baseProps, { ...baseProps, item: null }), false);
      assert.strictEqual(areFishCardPropsEqual({ ...baseProps, item: null }, baseProps), false);
      assert.strictEqual(areFishCardPropsEqual({ ...baseProps, item: null }, { ...baseProps, item: null }), true);
    });

    test('3.8: [Unit Test] getCategoryBadgeStyle maps taxonomy to brand colors', () => {
      assert.deepStrictEqual(getCategoryBadgeStyle('Marine Catch'), { backgroundColor: '#0284C7' });
      assert.deepStrictEqual(getCategoryBadgeStyle('Shellfish & Prawns'), { backgroundColor: '#D97706' });
      assert.deepStrictEqual(getCategoryBadgeStyle('Fresh Prawns'), { backgroundColor: '#D97706' });
      assert.deepStrictEqual(getCategoryBadgeStyle('Pond Harvest'), { backgroundColor: '#059669' });
      assert.deepStrictEqual(getCategoryBadgeStyle('Live Fish'), { backgroundColor: '#059669' });
      assert.deepStrictEqual(getCategoryBadgeStyle('Exotic Import'), { backgroundColor: '#0A1C33' });
      assert.deepStrictEqual(getCategoryBadgeStyle(''), { backgroundColor: '#0A1C33' });
    });
  });

  // =========================================================================
  // SUITE 4: [Production Unit Tests & Static Checks] OptimizedFishImage URI & Safety
  // =========================================================================
  describe('Suite 4: [Production Unit Tests & Static Checks] OptimizedFishImage URI & Safety', () => {
    // Note: Native Android image rendering and network-error behaviour cannot be executed in headless Node
    // and must be validated via physical device/emulator inspection. Production helper isValidImageUri is tested below.

    test('4.1: [Unit Test] isValidImageUri correctly rejects empty, whitespace, null, and non-string inputs', () => {
      assert.strictEqual(isValidImageUri(null), false);
      assert.strictEqual(isValidImageUri(undefined), false);
      assert.strictEqual(isValidImageUri(''), false);
      assert.strictEqual(isValidImageUri('   '), false);
      assert.strictEqual(isValidImageUri(12345), false);
      assert.strictEqual(isValidImageUri({}), false);
    });

    test('4.2: [Unit Test] isValidImageUri correctly accepts valid HTTP/HTTPS URLs', () => {
      assert.strictEqual(isValidImageUri('https://pondfish.in/storage/fish1.jpg'), true);
      assert.strictEqual(isValidImageUri('http://example.com/fish.png'), true);
    });

    test('4.3: [Static Source Check] OptimizedFishImage does not append speculative CDN parameters', () => {
      assert.ok(!optimizedImageCode.includes('?w='), 'Must not append speculative ?w= CDN params');
      assert.ok(!optimizedImageCode.includes('&format=webp'), 'Must not append speculative &format=webp');
      assert.ok(!optimizedImageCode.includes('?format='), 'Must not append speculative ?format=');
    });

    test('4.4: [Static Source Check] OptimizedFishImage removes unused isLoading state', () => {
      assert.ok(!optimizedImageCode.includes('isLoading'), 'Unused isLoading state must be completely removed');
      assert.ok(!optimizedImageCode.includes('setIsLoading'), 'setIsLoading setter must be completely removed');
    });

    test('4.5: [Static Source Check] OptimizedFishImage provides default 🐟 fallback and resets error on URI change', () => {
      assert.ok(optimizedImageCode.includes("fallbackText = '🐟'"), 'Default fallback must be 🐟');
      assert.ok(optimizedImageCode.includes('setHasError(false);'), 'Must reset error state');
      assert.ok(optimizedImageCode.includes('[uri]'), 'Must depend on uri in reset effect');
      assert.ok(optimizedImageCode.includes('onError='), 'Must hook onError handler');
    });
  });
});
