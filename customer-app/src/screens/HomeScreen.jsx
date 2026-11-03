/**
 * Screen: CP-02 — Customer Home Dashboard & Primary Fish Catalogue
 * Traceability: PondFish Customer Mobile App UI Specification (CP-02, CP-03) & .agent/skills/pondfish-mobile-ui-ux/SKILL.md
 * 
 * Shopping-first fish discovery screen combining header with location and profile shortcuts,
 * search filtering, dynamic category discovery, factual subscription quotas,
 * verified morning catch replenishment, virtualized 2-column fish catalogue, and floating sticky cart bar.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { Colors, Typography, Spacing, Radii, Shadows } from '../theme/tokens';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyStateView from '../components/EmptyStateView';
import ErrorStateView from '../components/ErrorStateView';
import FishCard from '../components/FishCard';
import OptimizedFishImage from '../components/OptimizedFishImage';
import { filterFishCatalogue } from '../utils/catalogue-filters';
import {
  SearchIcon,
  LocationPinIcon,
  CartIcon,
  CardIcon,
  MedalIcon,
  TruckIcon,
  TagIcon,
} from '../components/icons/NavIcons';

/**
 * Prioritized data retrieval orchestrator for HomeScreen.
 * Separated for direct unit/integration testability without mounting full React Native view tree.
 * 
 * 1. Critical initial content (Fish catalogue) unblocks visual display immediately upon arrival.
 * 2. Secondary content (Categories, Subscription, Tracking, Profile) loads concurrently in background.
 * 3. Cart summary is owned authoritatively by App shell props (redundant fetch removed).
 */
export async function fetchHomeDataOrchestrated({
  apiClient,
  setFishList,
  setCategories,
  setSubData,
  setTrackingData,
  setCustomer,
  setLoading,
  setRefreshing,
  setError,
  abortControllerRef,
  isMountedRef,
  requestSeqRef,
  isRefresh = false,
  existingCategories = null,
}) {
  // Cancel any previous in-flight requests
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  abortControllerRef.current = controller;

  const currentSeq = ++requestSeqRef.current;

  if (isRefresh) {
    setRefreshing(true);
  } else {
    setLoading(true);
    setError(null);
  }

  const signal = controller?.signal;

  // Priority 1: Critical Fish Catalogue
  const fishPromise = apiClient.getFish({}, { signal })
    .then((res) => {
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return;
      setFishList(res.data || []);
      setError(null);
      setLoading(false); // Unblock catalogue paint immediately
    })
    .catch((err) => {
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return;
      if (err.code === 'API_ABORTED') return;
      console.error('[HOME FISH LOAD ERROR]', err.message);
      // Preserve existing fish list on refresh failure; only show error state if catalogue is empty
      setFishList((prev) => {
        if (!prev || prev.length === 0) {
          setError(err.message || 'Unable to load today’s fish catalogue.');
        }
        return prev;
      });
      setLoading(false);
    });

  // Secondary Content (Executes concurrently in background without blocking fish catalogue)
  // Re-use already loaded categories unless explicitly refreshing
  const hasCategories = !isRefresh && Array.isArray(existingCategories) && existingCategories.length > 0;
  const catsPromise = hasCategories
    ? Promise.resolve().then(() => {
        if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return;
        setCategories(existingCategories);
      })
    : apiClient.getCategories({ signal, bypassCache: isRefresh })
        .then((res) => {
          if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return;
          setCategories(res.data || []);
        })
        .catch((err) => {
          if (err.code !== 'API_ABORTED') {
            console.warn('[HOME CATEGORIES NON-FATAL]', err.message);
          }
        });

  const subPromise = apiClient.getSubscription({ signal })
    .then((res) => {
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return;
      setSubData(res.data || null);
    })
    .catch((err) => {
      if (err.code !== 'API_ABORTED') {
        console.warn('[HOME SUBSCRIPTION NON-FATAL]', err.message);
      }
    });

  const trackingPromise = apiClient.getCustomerLiveTracking({ signal })
    .then((res) => {
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return;
      setTrackingData(res.data || null);
    })
    .catch((err) => {
      if (err.code !== 'API_ABORTED') {
        console.warn('[HOME TRACKING NON-FATAL]', err.message);
      }
    });

  const profilePromise = apiClient.getProfile(null, { signal })
    .then((res) => {
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) return;
      if (res.data) {
        setCustomer(res.data);
      }
    })
    .catch((err) => {
      if (err.code !== 'API_ABORTED') {
        console.warn('[HOME PROFILE NON-FATAL]', err.message);
      }
    });

  // Await all independent requests to settle before terminating refresh indicator
  try {
    await Promise.allSettled([fishPromise, catsPromise, subPromise, trackingPromise, profilePromise]);
  } finally {
    if (isMountedRef.current && currentSeq === requestSeqRef.current) {
      setRefreshing(false);
      setLoading(false);
    }
  }
}

export default function HomeScreen({
  routeParams = {},
  onNavigate,
  cartCount = 0,
  cartSummary: passedCartSummary = null,
  onCartUpdated,
}) {
  const initialCustomer = routeParams?.customer || {};
  const [customer, setCustomer] = useState(initialCustomer);
  const [fishList, setFishList] = useState([]);
  const [categories, setCategories] = useState([]);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const [subData, setSubData] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [cartSummary, setCartSummary] = useState(passedCartSummary);
  const [cartQuantities, setCartQuantities] = useState({});

  useEffect(() => {
    if (passedCartSummary) {
      setCartSummary(passedCartSummary);
    }
  }, [passedCartSummary]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');

  // Favorites & Cart state
  const [favorites, setFavorites] = useState({});
  const [addingFishId, setAddingFishId] = useState(null);

  // Request race condition prevention & cancellation
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  const customerName = customer?.name || 'Customer';

  // Verified Customer Address or Honest Unselected State
  const customerAddress =
    customer?.address?.formatted ||
    customer?.address?.street ||
    (typeof customer?.address === 'string' ? customer.address : null) ||
    customer?.selectedAddress ||
    routeParams?.selectedAddress ||
    null;

  const displayLocation = customerAddress
    ? (typeof customerAddress === 'string'
        ? customerAddress
        : `${customerAddress.area || customerAddress.street || ''}${customerAddress.city ? `, ${customerAddress.city}` : ''}`)
    : 'Select your location';

  const displayLocationSubtitle = customerAddress
    ? 'Store Counter Pickup & Local Delivery'
    : 'Choose pickup or delivery area';

  // Lifecycle cleanup: abort in-flight requests on screen unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Prioritized data retrieval delegating to fetchHomeDataOrchestrated
  const loadAllData = useCallback(async (isRefresh = false) => {
    return fetchHomeDataOrchestrated({
      apiClient: api,
      setFishList,
      setCategories,
      setSubData,
      setTrackingData,
      setCustomer,
      setLoading,
      setRefreshing,
      setError,
      abortControllerRef,
      isMountedRef,
      requestSeqRef,
      isRefresh,
      existingCategories: categoriesRef.current,
    });
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefresh = useCallback(() => {
    loadAllData(true);
  }, [loadAllData]);

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Authoritative Add-To-Cart flow with validation and real UUIDs
  const handleAddToCart = useCallback(async (item) => {
    if (!item.physicalAvailable) {
      Alert.alert('Out of Stock', `${item.name} is currently out of stock.`);
      return;
    }

    if (!item.onlineBookable) {
      Alert.alert(
        'In-Store Counter Only',
        `${item.name} is available for in-store counter purchase only. Online booking is currently disabled.`
      );
      return;
    }

    setAddingFishId(item.id);
    try {
      const result = await api.addToCart({
        fishId: item.id,
        quantity: 1,
      });

      if (result.data?.summary) {
        setCartSummary(result.data.summary);
      }
      setCartQuantities((prev) => ({
        ...prev,
        [item.id]: (prev[item.id] || 0) + 1,
      }));
      if (onCartUpdated) {
        onCartUpdated(result.data);
      }
    } catch (err) {
      console.error('[HOME ADD TO CART ERROR]', err.message);
      let msg = err.message || 'Could not add fish to cart.';
      if (err.code === 'FISH_NOT_ONLINE_BOOKABLE') {
        msg = 'Online booking is unavailable for this fish. In-store purchase only.';
      } else if (err.code === 'FISH_UNAVAILABLE') {
        msg = 'This fish is currently out of stock.';
      } else if (err.code === 'INVALID_FISH_ID') {
        msg = 'Invalid fish record.';
      }
      Alert.alert('Unable to Add', msg);
    } finally {
      setAddingFishId(null);
    }
  }, [onCartUpdated]);

  const handleIncrement = useCallback(async (item) => {
    const currentQty = cartQuantities[item.id] || 0;
    const nextQty = currentQty + 1;
    setAddingFishId(item.id);
    try {
      const result = await api.updateCartQuantity({
        fishId: item.id,
        quantity: nextQty,
      });
      if (result.data?.summary) {
        setCartSummary(result.data.summary);
      }
      setCartQuantities((prev) => ({ ...prev, [item.id]: nextQty }));
      if (onCartUpdated) {
        onCartUpdated(result.data);
      }
    } catch (err) {
      console.error('[HOME INCREMENT CART ERROR]', err.message);
    } finally {
      setAddingFishId(null);
    }
  }, [cartQuantities, onCartUpdated]);

  const handleDecrement = useCallback(async (item) => {
    const currentQty = cartQuantities[item.id] || 0;
    if (currentQty <= 1) {
      setAddingFishId(item.id);
      try {
        const result = await api.removeFromCart(item.id);
        if (result.data?.summary) {
          setCartSummary(result.data.summary);
        }
        setCartQuantities((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        if (onCartUpdated) {
          onCartUpdated(result.data);
        }
      } catch (err) {
        console.error('[HOME REMOVE FROM CART ERROR]', err.message);
      } finally {
        setAddingFishId(null);
      }
    } else {
      const nextQty = currentQty - 1;
      setAddingFishId(item.id);
      try {
        const result = await api.updateCartQuantity({
          fishId: item.id,
          quantity: nextQty,
        });
        if (result.data?.summary) {
          setCartSummary(result.data.summary);
        }
        setCartQuantities((prev) => ({ ...prev, [item.id]: nextQty }));
        if (onCartUpdated) {
          onCartUpdated(result.data);
        }
      } catch (err) {
        console.error('[HOME DECREMENT CART ERROR]', err.message);
      } finally {
        setAddingFishId(null);
      }
    }
  }, [cartQuantities, onCartUpdated]);

  const handleNavigateDetails = useCallback((item) => {
    if (onNavigate) {
      onNavigate('FISH_DETAILS', { fishId: item.id, fish: item });
    }
  }, [onNavigate]);

  const keyExtractor = useCallback((item) => String(item.id || item._id || item.name), []);

  // Discounted items filter for Catch Offers
  const discountedFish = useMemo(() => {
    return fishList.filter((f) => f.pricing && f.pricing.hasDiscount);
  }, [fishList]);

  // Client-side catalogue filter using pure production helper
  const filteredFishes = useMemo(() => {
    return filterFishCatalogue(fishList, {
      categoryId: selectedCategoryId,
      availability: availabilityFilter,
      searchQuery,
    });
  }, [fishList, selectedCategoryId, availabilityFilter, searchQuery]);

  const renderEmptyState = useCallback(() => {
    if (searchQuery.trim()) {
      return (
        <EmptyStateView
          emoji="🔍"
          title="No Matching Fish"
          message={`No fish found matching "${searchQuery}". Try a different search term.`}
          actionLabel="Clear Search"
          onAction={() => setSearchQuery('')}
        />
      );
    }

    if (selectedCategoryId) {
      return (
        <EmptyStateView
          emoji="🐟"
          title="No Catch in This Category"
          message="Selected category has no fish in stock today. Browse other fresh varieties."
          actionLabel="View All Fishes"
          onAction={() => setSelectedCategoryId(null)}
        />
      );
    }

    if (availabilityFilter !== 'ALL') {
      return (
        <EmptyStateView
          emoji="🏷"
          title="No Matching Catch"
          message="No fishes currently match this availability filter."
          actionLabel="Show All"
          onAction={() => setAvailabilityFilter('ALL')}
        />
      );
    }

    return (
      <EmptyStateView
        emoji="🎣"
        title="No Fresh Fish Available Today"
        message="Morning lake catch delivery has not replenished counter stock yet. Check back shortly."
        actionLabel="Refresh Catalogue"
        onAction={loadAllData}
      />
    );
  }, [searchQuery, selectedCategoryId, availabilityFilter, loadAllData]);

  const renderFishItem = useCallback(({ item }) => {
    return (
      <FishCard
        item={item}
        isFav={Boolean(favorites[item.id])}
        isAdding={addingFishId === item.id}
        cartQuantity={cartQuantities[item.id] || 0}
        quantityInCart={cartQuantities[item.id] || 0}
        onToggleFav={toggleFavorite}
        onAddToCart={handleAddToCart}
        onPress={handleNavigateDetails}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
      />
    );
  }, [
    favorites,
    addingFishId,
    cartQuantities,
    toggleFavorite,
    handleAddToCart,
    handleNavigateDetails,
    handleIncrement,
    handleDecrement,
  ]);

  // Information hierarchy prioritized for shopping discovery:
  // Compact status alerts -> Category Discovery -> Special Offers -> Previously Purchased
  const renderListHeader = useMemo(() => {
    return (
      <View>
        <DashboardBanners
          subData={subData}
          trackingData={trackingData}
          onNavigate={onNavigate}
        />
        <CatalogueHeaderControls
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          availabilityFilter={availabilityFilter}
          onSelectAvailability={setAvailabilityFilter}
        />
        <FlashSaleCarousel
          discountedFish={discountedFish}
          favorites={favorites}
          addingFishId={addingFishId}
          cartQuantities={cartQuantities}
          onToggleFav={toggleFavorite}
          onAddToCart={handleAddToCart}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onNavigate={onNavigate}
        />
        <PreviouslyBoughtCarousel
          fishList={fishList}
          favorites={favorites}
          cartQuantities={cartQuantities}
          onToggleFav={toggleFavorite}
          onAddToCart={handleAddToCart}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onNavigate={onNavigate}
        />
      </View>
    );
  }, [
    subData,
    trackingData,
    onNavigate,
    categories,
    selectedCategoryId,
    availabilityFilter,
    discountedFish,
    favorites,
    addingFishId,
    cartQuantities,
    toggleFavorite,
    handleAddToCart,
    handleIncrement,
    handleDecrement,
    fishList,
  ]);

  const renderEmptyComponent = useMemo(() => {
    if (loading) {
      return <LoadingSkeleton count={4} />;
    }
    if (error) {
      return (
        <ErrorStateView
          title="Unable to load today's fish."
          message={error}
          onRetry={loadAllData}
        />
      );
    }
    return renderEmptyState();
  }, [loading, error, loadAllData, renderEmptyState]);

  const renderFooter = useMemo(() => {
    if (loading || error || filteredFishes.length === 0) {
      return <View style={styles.footerSpacing} />;
    }
    return (
      <View style={styles.footerContainer}>
        {selectedCategoryId && (
          <TouchableOpacity
            style={styles.showMoreBtn}
            onPress={() => setSelectedCategoryId(null)}
            activeOpacity={0.85}
          >
            <Text style={styles.showMoreBtnText}>View All Fishes in Marketplace →</Text>
          </TouchableOpacity>
        )}
        <View style={styles.footerSpacing} />
      </View>
    );
  }, [loading, error, filteredFishes.length, selectedCategoryId]);

  const totalCartItems = cartSummary?.totalItems ?? cartCount ?? 0;
  const totalCartAmount = cartSummary?.totalAmount ?? 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brandNavy} />

      {/* 1. TOP HEADER (PondFish Brand Navy) */}
      <View style={styles.topHeader}>
        <View style={styles.headerRowTop}>
          {/* Location & Brand Group */}
          <View style={styles.headerLeftGroup}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.headerLogoBadge}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.locationContainer}
              onPress={() => onNavigate && onNavigate('PROFILE')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={customerAddress ? `Selected delivery location: ${displayLocation}` : 'Select your location'}
            >
              <View style={styles.locationTitleRow}>
                <LocationPinIcon size={14} color={Colors.actionGreen} />
                <Text style={styles.locationTitleText} numberOfLines={1}>{displayLocation}</Text>
                <Text style={styles.locationChevron}>▾</Text>
              </View>
              <Text style={styles.locationSubtitleText}>
                {displayLocationSubtitle}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right Header: Subscription Pass & Avatar */}
          <View style={styles.headerRightGroup}>
            <TouchableOpacity
              style={styles.clubPassPill}
              onPress={() => onNavigate('SUBSCRIPTION')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="View PondFish Club Pass"
            >
              <CardIcon size={14} color={Colors.textWhite} />
              <Text style={styles.clubPassText}>
                {subData?.hasSubscription && subData.subscription
                  ? `₹${subData.subscription.creditBalance ?? 0}`
                  : 'Club'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.userAvatarBtn}
              onPress={() => onNavigate('PROFILE')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="View Profile"
            >
              <Text style={styles.avatarInitials}>
                {customerName.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Functional Search Bar */}
        <View style={styles.searchBarRow}>
          <View style={styles.searchBar}>
            <SearchIcon size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder='Search "fresh pomfret, rohu, prawns"...'
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search fish catalogue"
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* 2. VIRTUALIZED DASHBOARD & CATALOGUE */}
      <FlatList
        data={loading || error ? [] : filteredFishes}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={filteredFishes.length > 0 ? styles.gridRow : undefined}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.actionGreen}
            colors={[Colors.actionGreen]}
          />
        }
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        ListFooterComponent={renderFooter}
        renderItem={renderFishItem}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* 3. PERSISTENT STICKY CART ACTION BAR */}
      {totalCartItems > 0 && (
        <View style={styles.stickyCartBar}>
          <View style={styles.stickyCartInfo}>
            <View style={styles.stickyCartIconBox}>
              <CartIcon size={18} color={Colors.textWhite} />
            </View>
            <View>
              <Text style={styles.stickyCartTitle}>
                {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'} • ₹{totalCartAmount}
              </Text>
              <Text style={styles.stickyCartSubtitle}>
                Dressed & prepared fresh at counter
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.stickyCartCta}
            onPress={() => onNavigate('CART')}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`View basket with ${totalCartItems} items`}
          >
            <Text style={styles.stickyCartCtaText}>View Basket →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/**
 * Dashboard top banners: Compact Factual Subscription Quota & Verified Catch Transport.
 * Memoized to prevent re-renders when catalogue filters or favorites change.
 */
const DashboardBanners = React.memo(function DashboardBanners({ subData, trackingData, onNavigate }) {
  const hasSub = Boolean(subData?.hasSubscription && subData.subscription);
  const hasTracking = Boolean(trackingData?.active && trackingData?.truckNumber);

  if (!hasSub && !hasTracking) {
    return null;
  }

  return (
    <View style={styles.bannersWrapper}>
      {/* Factual Subscription Banner - Rendered ONLY if genuine subscription exists */}
      {hasSub && (
        <TouchableOpacity
          style={styles.quotaBanner}
          onPress={() => onNavigate('SUBSCRIPTION')}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="View subscription quota"
        >
          <View style={styles.quotaMedalCircle}>
            <MedalIcon size={16} color={Colors.warning} />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={styles.quotaTitle}>
              {subData.subscription.planTitle || 'Club Member'}: {subData.subscription.weeklyRemainingKg ?? 0} kg quota remaining
            </Text>
            <Text style={styles.quotaSubtitle}>
              {subData.subscription.weeklyClaimedKg ?? 0} kg claimed • Resets in {subData.subscription.daysRemaining ?? '—'} days
            </Text>
          </View>
          <View style={styles.rechargeBtn}>
            <Text style={styles.rechargeBtnText}>Manage</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Morning Catch Supply Transport - Rendered ONLY if genuine tracking data exists */}
      {hasTracking && (
        <TouchableOpacity
          style={styles.liveTruckCard}
          onPress={() => onNavigate('LIVE_TRACKING')}
          activeOpacity={0.9}
        >
          <View style={styles.truckCardTopRow}>
            <View style={styles.truckLiveBadge}>
              <View style={styles.greenPulseDot} />
              <TruckIcon size={14} color={Colors.textWhite} />
              <Text style={styles.truckLiveText}>
                Fresh Catch Supply #{trackingData.truckNumber}
              </Text>
            </View>
            <View style={styles.etaPill}>
              <Text style={styles.etaPillText}>En Route</Text>
            </View>
          </View>

          <View style={styles.truckCardMidRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.truckFarmTitle}>
                {trackingData.origin?.name
                  ? `Departed ${trackingData.origin.name}`
                  : 'Harbor replenishment en route'}
              </Text>
              <Text style={styles.truckDestSubtitle}>
                Destination: {trackingData.destination?.name || 'Retail Store Counter'}
              </Text>
            </View>
            <View style={styles.trackLiveBtn}>
              <Text style={styles.trackLiveBtnText}>Track Supply →</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
});

/**
 * Offers on Selected Fishes horizontal carousel.
 * Memoized to update only when discountedFish, favorites, or addingFishId change.
 */
const FlashSaleCarousel = React.memo(function FlashSaleCarousel({
  discountedFish,
  favorites,
  addingFishId,
  cartQuantities = {},
  onToggleFav,
  onAddToCart,
  onIncrement,
  onDecrement,
  onNavigate,
}) {
  if (!discountedFish || discountedFish.length === 0) return null;

  return (
    <View style={styles.flashSaleContainer}>
      <View style={styles.flashHeaderRow}>
        <View style={styles.flashIconCircle}>
          <TagIcon size={14} color={Colors.actionGreen} />
        </View>
        <View style={{ flex: 1, paddingLeft: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.flashSectionTitle}>Offers on Selected Fishes</Text>
            <View style={styles.flashBadgeGreen}>
              <Text style={styles.flashBadgeGreenText}>TODAY'S SPECIAL</Text>
            </View>
          </View>
          <Text style={styles.flashSectionSubtitle}>
            Verified catch available at retail counter prices
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flashCardsScroll}
      >
        {discountedFish.map((item) => {
          const discountText = item.pricing?.discount?.percent
            ? `${item.pricing.discount.percent}% OFF`
            : item.pricing?.discount?.flatAmount
            ? `₹${item.pricing.discount.flatAmount} OFF`
            : 'SPECIAL';

          const qty = cartQuantities[item.id] || 0;
          const isPhysicalAvailable = Boolean(item.physicalAvailable);
          const isOnlineBookable = Boolean(item.onlineBookable);

          return (
            <View key={item.id} style={styles.flashCard}>
              <View style={styles.flashCardTop}>
                <View style={styles.discountTag}>
                  <Text style={styles.discountTagText}>{discountText}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => onToggleFav(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.heartIcon, favorites[item.id] && styles.heartActive]}>
                    {favorites[item.id] ? '♥' : '♡'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => onNavigate('FISH_DETAILS', { fishId: item.id, fish: item })}
                style={styles.flashImageBox}
                activeOpacity={0.88}
              >
                <OptimizedFishImage
                  uri={item.imageUrl}
                  style={styles.flashImage}
                  resizeMode="cover"
                  testID={`flash-image-${item.id}`}
                />
              </TouchableOpacity>

              <Text style={styles.flashFishName} numberOfLines={2}>
                {item.name}
              </Text>
              {Boolean(item.unitBasis) && (
                <Text style={styles.flashWeightText}>
                  {item.unitBasis}
                </Text>
              )}

              <View style={styles.pricingRow}>
                <Text style={styles.currentPrice}>
                  ₹{item.pricing?.effectivePrice || item.unitPrice}
                </Text>
                <Text style={styles.originalPrice}>₹{item.unitPrice}</Text>
              </View>

              <View style={styles.flashCardActionRow}>
                {qty > 0 && isPhysicalAvailable && isOnlineBookable ? (
                  <View style={styles.stepperContainerMini}>
                    <TouchableOpacity
                      style={styles.stepperBtnMini}
                      onPress={() => onDecrement && onDecrement(item)}
                    >
                      <Text style={styles.stepperGlyph}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperQtyTextMini}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtnMini}
                      onPress={() => onIncrement ? onIncrement(item) : onAddToCart(item)}
                    >
                      <Text style={styles.stepperGlyph}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.addBtnGreen,
                      !isPhysicalAvailable && styles.addBtnDisabled,
                      isPhysicalAvailable && !isOnlineBookable && styles.inStoreBtnMini,
                    ]}
                    onPress={() => onAddToCart(item)}
                    disabled={addingFishId === item.id || !isPhysicalAvailable}
                    activeOpacity={0.8}
                  >
                    {addingFishId === item.id ? (
                      <ActivityIndicator size="small" color={Colors.textWhite} />
                    ) : (
                      <Text
                        style={[
                          styles.addBtnGreenText,
                          !isPhysicalAvailable && styles.addBtnDisabledText,
                          isPhysicalAvailable && !isOnlineBookable && styles.inStoreBtnMiniText,
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
        })}
      </ScrollView>
    </View>
  );
});

/**
 * Previously bought horizontal carousel.
 * Memoized to update only when fishList or favorites change.
 */
const PreviouslyBoughtCarousel = React.memo(function PreviouslyBoughtCarousel({
  fishList,
  favorites,
  cartQuantities = {},
  onToggleFav,
  onAddToCart,
  onIncrement,
  onDecrement,
  onNavigate,
}) {
  if (!fishList || fishList.length === 0) return null;

  return (
    <View style={styles.previouslyBoughtContainer}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>Previously bought</Text>
        <TouchableOpacity onPress={() => onNavigate('BOOKING_HISTORY')}>
          <Text style={styles.seeAllText}>Order History →</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.prevBoughtScroll}
      >
        {fishList.slice(0, 4).map((item) => {
          const qty = cartQuantities[item.id] || 0;
          const isPhysicalAvailable = Boolean(item.physicalAvailable);
          const isOnlineBookable = Boolean(item.onlineBookable);

          return (
            <View key={`prev-${item.id}`} style={styles.prevBoughtCard}>
              <TouchableOpacity
                style={styles.prevHeartBtn}
                onPress={() => onToggleFav(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.heartIcon, favorites[item.id] && styles.heartActive]}>
                  {favorites[item.id] ? '♥' : '♡'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onNavigate('FISH_DETAILS', { fishId: item.id, fish: item })}
                style={styles.prevImageBox}
                activeOpacity={0.88}
              >
                <OptimizedFishImage
                  uri={item.imageUrl}
                  style={styles.prevImage}
                  resizeMode="cover"
                  testID={`prev-image-${item.id}`}
                />
              </TouchableOpacity>

              <Text style={styles.prevFishName} numberOfLines={2}>
                {item.name}
              </Text>

              <View style={styles.prevPricingRow}>
                <Text style={styles.prevPriceText}>
                  ₹{item.pricing?.effectivePrice || item.unitPrice}
                </Text>
                {Boolean(item.pricing?.hasDiscount) && (
                  <Text style={styles.prevStrikePrice}>₹{item.unitPrice}</Text>
                )}
              </View>

              <View style={styles.prevActionRow}>
                {qty > 0 && isPhysicalAvailable && isOnlineBookable ? (
                  <View style={styles.stepperContainerMini}>
                    <TouchableOpacity
                      style={styles.stepperBtnMini}
                      onPress={() => onDecrement && onDecrement(item)}
                    >
                      <Text style={styles.stepperGlyph}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperQtyTextMini}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtnMini}
                      onPress={() => onIncrement ? onIncrement(item) : onAddToCart(item)}
                    >
                      <Text style={styles.stepperGlyph}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.prevAddBtn,
                      !isPhysicalAvailable && styles.addBtnDisabled,
                      isPhysicalAvailable && !isOnlineBookable && styles.inStoreBtnMini,
                    ]}
                    onPress={() => onAddToCart(item)}
                    disabled={!isPhysicalAvailable}
                  >
                    <Text
                      style={[
                        styles.prevAddBtnText,
                        !isPhysicalAvailable && styles.addBtnDisabledText,
                        isPhysicalAvailable && !isOnlineBookable && styles.inStoreBtnMiniText,
                      ]}
                    >
                      {!isPhysicalAvailable ? 'SOLD' : !isOnlineBookable ? 'IN STORE' : '+ ADD'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

/**
 * Available Fishes section header, Category Discovery Pills, and Availability Filter Chips.
 * Memoized to re-render only when categories or active filter selections change.
 */
const CatalogueHeaderControls = React.memo(function CatalogueHeaderControls({
  categories,
  selectedCategoryId,
  onSelectCategory,
  availabilityFilter,
  onSelectAvailability,
}) {
  const filters = [
    { key: 'ALL', label: 'All Catch' },
    { key: 'BOOKABLE', label: 'Online Bookable' },
    { key: 'IN_STORE', label: 'In-Store Only' },
    { key: 'DISCOUNT', label: 'Offers' },
  ];

  return (
    <View style={styles.catalogueHeaderWrapper}>
      {/* Primary Fish Catalogue Section Title */}
      <View style={styles.availableSectionHeader}>
        <View>
          <Text style={styles.sectionHeading}>Available Fishes</Text>
          <Text style={styles.availableSub}>
            Live-fish retail prepared fresh to order at store counter
          </Text>
        </View>
      </View>

      {/* Dynamic Category Discovery Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        <TouchableOpacity
          style={[
            styles.categoryPill,
            selectedCategoryId === null && styles.categoryPillActive,
          ]}
          onPress={() => onSelectCategory(null)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.categoryPillText,
              selectedCategoryId === null && styles.categoryPillTextActive,
            ]}
          >
            All Fish
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const isActive = selectedCategoryId === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              onPress={() => onSelectCategory(isActive ? null : cat.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  isActive && styles.categoryPillTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Availability Filter Chips */}
      <View style={styles.filterRow}>
        {filters.map((f) => {
          const isActive = availabilityFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onSelectAvailability(f.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    backgroundColor: Colors.brandNavy,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomLeftRadius: Radii.xl,
    borderBottomRightRadius: Radii.xl,
  },
  headerRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  headerLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surface,
  },
  locationContainer: {
    flex: 1,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationTitleText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textWhite,
    fontSize: 14,
  },
  locationChevron: {
    color: Colors.actionGreen,
    fontSize: 12,
    fontWeight: '800',
  },
  locationSubtitleText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubPassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  clubPassText: {
    color: Colors.textWhite,
    fontSize: 12,
    fontWeight: '700',
  },
  userAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.brandNavyLight,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '400',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  scrollBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 110, // Prevents content occlusion by sticky cart bar & bottom nav
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  bannersWrapper: {
    marginBottom: 6,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningSubtle,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: Radii.lg,
    padding: 10,
    marginBottom: 8,
  },
  quotaMedalCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  quotaSubtitle: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  rechargeBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rechargeBtnText: {
    color: Colors.brandNavy,
    fontSize: 11,
    fontWeight: '700',
  },
  liveTruckCard: {
    backgroundColor: Colors.brandNavy,
    borderRadius: Radii.lg,
    padding: 10,
    marginBottom: 8,
    ...Shadows.card,
  },
  truckCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  truckLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.actionGreen,
  },
  truckLiveText: {
    color: Colors.textWhite,
    fontSize: 11,
    fontWeight: '700',
  },
  etaPill: {
    backgroundColor: 'rgba(0, 155, 112, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.xs,
  },
  etaPillText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '700',
  },
  truckCardMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  truckFarmTitle: {
    color: Colors.textWhite,
    fontSize: 11,
    fontWeight: '600',
  },
  truckDestSubtitle: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  trackLiveBtn: {
    backgroundColor: Colors.actionGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  trackLiveBtnText: {
    color: Colors.textWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  flashSaleContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadows.card,
  },
  flashHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flashIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.actionGreenSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashSectionTitle: {
    ...Typography.sectionTitle,
    fontSize: 14,
  },
  flashBadgeGreen: {
    backgroundColor: Colors.actionGreenSubtle,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radii.xs,
  },
  flashBadgeGreenText: {
    color: Colors.actionGreen,
    fontSize: 9,
    fontWeight: '800',
  },
  flashSectionSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  flashCardsScroll: {
    paddingRight: 10,
    gap: 8,
  },
  flashCard: {
    width: 125,
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  flashCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  discountTag: {
    backgroundColor: Colors.actionGreen,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radii.xs,
  },
  discountTagText: {
    color: Colors.textWhite,
    fontSize: 9,
    fontWeight: '800',
  },
  heartIcon: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  heartActive: {
    color: Colors.error,
  },
  flashImageBox: {
    width: '100%',
    height: 75,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    marginBottom: 4,
  },
  flashImage: {
    width: '100%',
    height: '100%',
  },
  flashFishName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brandNavy,
    lineHeight: 14,
    minHeight: 28,
  },
  flashWeightText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 6,
  },
  currentPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.brandNavy,
  },
  originalPrice: {
    fontSize: 10,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  flashCardActionRow: {
    marginTop: 'auto',
  },
  addBtnGreen: {
    backgroundColor: Colors.actionGreenSubtle,
    borderWidth: 1,
    borderColor: Colors.actionGreen,
    borderRadius: Radii.sm,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnGreenText: {
    color: Colors.actionGreen,
    fontSize: 10,
    fontWeight: '800',
  },
  addBtnDisabled: {
    borderColor: Colors.borderMedium,
    backgroundColor: Colors.surfaceSubtle,
  },
  addBtnDisabledText: {
    color: Colors.textMuted,
  },
  inStoreBtnMini: {
    borderColor: Colors.brandBlue,
    backgroundColor: Colors.brandBlueSubtle,
  },
  inStoreBtnMiniText: {
    color: Colors.brandBlue,
    fontSize: 9,
    fontWeight: '800',
  },
  stepperContainerMini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.actionGreenSubtle,
    borderWidth: 1,
    borderColor: Colors.actionGreen,
    borderRadius: Radii.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtnMini: {
    paddingHorizontal: 4,
  },
  stepperGlyph: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.actionGreen,
  },
  stepperQtyTextMini: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.actionGreen,
  },
  previouslyBoughtContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeading: {
    ...Typography.sectionTitle,
    fontSize: 15,
    color: Colors.brandNavy,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brandBlue,
  },
  prevBoughtScroll: {
    paddingRight: 10,
    gap: 8,
  },
  prevBoughtCard: {
    width: 115,
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    position: 'relative',
  },
  prevHeartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
  },
  prevImageBox: {
    width: '100%',
    height: 65,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    marginBottom: 4,
  },
  prevImage: {
    width: '100%',
    height: '100%',
  },
  prevFishName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brandNavy,
    lineHeight: 14,
    minHeight: 28,
  },
  prevPricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
  },
  prevPriceText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.brandNavy,
  },
  prevStrikePrice: {
    fontSize: 9,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  prevActionRow: {
    marginTop: 'auto',
  },
  prevAddBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.actionGreen,
    borderRadius: Radii.xs,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevAddBtnText: {
    color: Colors.actionGreen,
    fontSize: 10,
    fontWeight: '800',
  },
  catalogueHeaderWrapper: {
    marginBottom: 8,
  },
  availableSectionHeader: {
    marginBottom: 8,
  },
  availableSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  categoryScroll: {
    paddingRight: 10,
    gap: 8,
    marginBottom: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  categoryPillActive: {
    backgroundColor: Colors.brandNavy,
    borderColor: Colors.brandNavy,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.textWhite,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: Colors.actionGreenSubtle,
    borderColor: Colors.actionGreen,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.actionGreen,
    fontWeight: '700',
  },
  stickyCartBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    height: 52,
    backgroundColor: Colors.brandNavy,
    borderRadius: Radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 100,
    ...Shadows.floatingBar,
  },
  stickyCartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stickyCartIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyCartTitle: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '700',
  },
  stickyCartSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    marginTop: 1,
  },
  stickyCartCta: {
    backgroundColor: Colors.actionGreen,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.pill,
  },
  stickyCartCtaText: {
    color: Colors.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
  footerContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  showMoreBtn: {
    backgroundColor: Colors.brandBlueSubtle,
    borderWidth: 1,
    borderColor: Colors.brandBlue,
    borderRadius: Radii.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  showMoreBtnText: {
    color: Colors.brandBlue,
    fontSize: 13,
    fontWeight: '700',
  },
  footerSpacing: {
    height: 30,
  },
});
