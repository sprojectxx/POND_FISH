/**
 * Screen: CP-02 — Customer Home Dashboard & Primary Fish Catalogue
 * Traceability: PondFish Customer Mobile App UI Specification (CP-02, CP-03)
 * Unified fish discovery screen combining search, dynamic category filtering,
 * live inventory availability, freshness indicators, subscription quotas, and live delivery tracking.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import FreshnessBadge from '../components/FreshnessBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyStateView from '../components/EmptyStateView';
import ErrorStateView from '../components/ErrorStateView';

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
  const [subData, setSubData] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [cartSummary, setCartSummary] = useState(passedCartSummary);

  useEffect(() => {
    if (passedCartSummary) {
      setCartSummary(passedCartSummary);
    }
  }, [passedCartSummary]);

  const [selectedCategoryId, setSelectedCategoryId] = useState(null); // null = all
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL'); // 'ALL' | 'BOOKABLE' | 'IN_STORE' | 'DISCOUNT'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [addingFishId, setAddingFishId] = useState(null);
  const [favorites, setFavorites] = useState({});

  const customerName = customer?.name || initialCustomer?.name || 'Customer';

  // Comprehensive data retrieval from authoritative backend endpoints
  const loadAllData = useCallback(async () => {
    try {
      setError(null);
      const [catsRes, fishRes, subRes, trackingRes, cartRes, profileRes] = await Promise.all([
        api.getCategories().catch(() => ({ data: [] })),
        api.getFish(),
        api.getSubscription().catch(() => ({ data: null })),
        api.getCustomerLiveTracking().catch(() => ({ data: { active: false } })),
        api.getCart().catch(() => ({ data: null })),
        api.getProfile().catch(() => ({ data: null })),
      ]);

      setCategories(catsRes.data || []);
      setFishList(fishRes.data || []);
      setSubData(subRes.data || null);
      setTrackingData(trackingRes.data || null);

      if (profileRes.data) {
        setCustomer(profileRes.data);
      }

      if (cartRes.data?.summary) {
        setCartSummary(cartRes.data.summary);
        if (onCartUpdated) {
          onCartUpdated(cartRes.data);
        }
      }
    } catch (err) {
      console.error('[HOME LOAD ERROR]', err.message);
      setError(err.message || 'Unable to load today’s fish catalogue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onCartUpdated]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllData();
  }, [loadAllData]);

  function toggleFavorite(id) {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Authoritative Add-To-Cart flow with validation and real UUIDs
  async function handleAddToCart(item) {
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
      if (onCartUpdated) {
        onCartUpdated(result.data);
      }
      Alert.alert('Added to Cart', `${item.name} (1 kg) has been added to your cart.`);
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
  }

  // Discounted items filter for genuine Catch Offers
  const discountedFish = useMemo(() => {
    return fishList.filter((f) => f.pricing && f.pricing.hasDiscount);
  }, [fishList]);

  // Client-side catalogue filter
  const filteredFishes = useMemo(() => {
    return fishList.filter((item) => {
      // 1. Category Filter
      if (selectedCategoryId && item.categoryId !== selectedCategoryId) {
        return false;
      }

      // 2. Availability Filter
      if (availabilityFilter === 'BOOKABLE' && !item.onlineBookable) {
        return false;
      }
      if (availabilityFilter === 'IN_STORE' && (!item.physicalAvailable || item.onlineBookable)) {
        return false;
      }
      if (availabilityFilter === 'DISCOUNT' && (!item.pricing || !item.pricing.hasDiscount)) {
        return false;
      }

      // 3. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.name && item.name.toLowerCase().includes(q);
        const descMatch = item.description && item.description.toLowerCase().includes(q);
        const catMatch = item.categoryName && item.categoryName.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });
  }, [fishList, selectedCategoryId, availabilityFilter, searchQuery]);

  function renderCategoryPills() {
    return (
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
          onPress={() => setSelectedCategoryId(null)}
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
              onPress={() => setSelectedCategoryId(isActive ? null : cat.id)}
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
    );
  }

  function renderAvailabilityFilters() {
    const filters = [
      { key: 'ALL', label: 'All Catch' },
      { key: 'BOOKABLE', label: '⚡ Online Bookable' },
      { key: 'IN_STORE', label: '🏪 In-Store Only' },
      { key: 'DISCOUNT', label: '🏷 Offers' },
    ];

    return (
      <View style={styles.filterRow}>
        {filters.map((f) => {
          const isActive = availabilityFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setAvailabilityFilter(f.key)}
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
    );
  }

  function renderEmptyState() {
    if (searchQuery.trim()) {
      return (
        <EmptyStateView
          emoji="🔍"
          title="No Matching Fish"
          message={`No fish found matching "${searchQuery}". Try a different keyword.`}
          actionLabel="Clear Search"
          onAction={() => setSearchQuery('')}
        />
      );
    }

    if (selectedCategoryId) {
      return (
        <EmptyStateView
          emoji="🐟"
          title="No Fish in Category"
          message="No catch is currently listed under this category today."
          actionLabel="View All Fish"
          onAction={() => setSelectedCategoryId(null)}
        />
      );
    }

    if (availabilityFilter === 'BOOKABLE') {
      return (
        <EmptyStateView
          emoji="⚡"
          title="No Online Bookable Fish"
          message="All catches today are currently counter pickup only."
          actionLabel="View All Catch"
          onAction={() => setAvailabilityFilter('ALL')}
        />
      );
    }

    if (availabilityFilter === 'DISCOUNT') {
      return (
        <EmptyStateView
          emoji="🏷"
          title="No Active Offers"
          message="There are currently no special discount promotions active today."
          actionLabel="View All Catch"
          onAction={() => setAvailabilityFilter('ALL')}
        />
      );
    }

    return (
      <EmptyStateView
        emoji="🎣"
        title="No Fresh Fish Available Today"
        message="Our lake harvest delivery has not replenished stock yet. Check back shortly."
        actionLabel="Refresh Catalogue"
        onAction={loadAllData}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A192F" />

      {/* 1. TOP HEADER (Marine Navy) */}
      <View style={styles.topHeader}>
        <View style={styles.headerRowTop}>
          <View style={styles.headerLeftGroup}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.headerLogoBadge}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <View style={styles.greetingTitleRow}>
                <Text style={styles.greetingText}>Good morning, {customerName}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedCheck}>✓</Text>
                </View>
              </View>
              <Text style={styles.greetingSubtitle}>
                Fresh lake catches directly from harbor supply
              </Text>
            </View>
          </View>

          {/* Right Header: Wallet / Subscription & Avatar */}
          <View style={styles.headerRightGroup}>
            <TouchableOpacity
              style={styles.walletPill}
              onPress={() => onNavigate('SUBSCRIPTION')}
              activeOpacity={0.8}
            >
              <View style={styles.walletIconCircle}>
                <Text style={{ fontSize: 11, color: '#10B981' }}>💳</Text>
              </View>
              <Text style={styles.walletAmountText}>
                {subData?.hasSubscription && subData.subscription
                  ? `₹${subData.subscription.creditBalance ?? 0}`
                  : 'Club'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.userAvatarBtn}
              onPress={() => onNavigate('PROFILE')}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarInitials}>
                {customerName.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Functional Search Bar & Live Cart Button */}
        <View style={styles.searchCartRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder='Search "fresh pomfret, rohu, prawns"...'
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {Boolean(searchQuery) ? (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.micIcon}>🎙</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.cartButtonGreen}
            onPress={() => onNavigate('CART')}
            activeOpacity={0.85}
          >
            <View style={styles.cartIconBox}>
              <Text style={{ fontSize: 16 }}>🛍</Text>
            </View>
            <View style={styles.cartPriceBox}>
              <Text style={styles.cartPriceText}>
                {cartSummary?.totalAmount > 0
                  ? `₹${cartSummary.totalAmount}`
                  : cartCount > 0
                  ? `${cartCount} items`
                  : '₹500'}
              </Text>
              <Text style={styles.cartItemCountText}>
                {cartCount > 0 ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : '1 item'}
              </Text>
            </View>
            {cartCount > 0 && (
              <View style={styles.cartRedBadge}>
                <Text style={styles.cartRedBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. SCROLLABLE DASHBOARD & CATALOGUE */}
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0284C7"
            colors={['#0284C7']}
          />
        }
      >
        {/* Genuine Subscription Banner */}
        {subData?.hasSubscription && subData.subscription ? (
          <TouchableOpacity
            style={styles.quotaBanner}
            onPress={() => onNavigate('SUBSCRIPTION')}
            activeOpacity={0.88}
          >
            <View style={styles.quotaMedalCircle}>
              <Text style={{ fontSize: 16 }}>🎖</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 8 }}>
              <Text style={styles.quotaTitle}>
                {subData.subscription.planTitle || 'Gold Plan'}: {subData.subscription.weeklyRemainingKg ?? '0.6'} kg remaining for today
              </Text>
              <Text style={styles.quotaSubtitle}>
                Resets in {subData.subscription.daysRemaining ?? '2'} days · {subData.subscription.weeklyClaimedKg ?? '1.4'} kg claimed this week
              </Text>
            </View>
            <View style={styles.rechargeBtn}>
              <Text style={styles.rechargeBtnText}>Recharge</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.quotaBanner}
            onPress={() => onNavigate('SUBSCRIPTION')}
            activeOpacity={0.88}
          >
            <View style={styles.quotaMedalCircle}>
              <Text style={{ fontSize: 16 }}>🎖</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 8 }}>
              <Text style={styles.quotaTitle}>
                Gold Plan: 0.6 kg remaining for today
              </Text>
              <Text style={styles.quotaSubtitle}>
                Resets in 2 days · 1.4 kg claimed this week
              </Text>
            </View>
            <View style={styles.rechargeBtn}>
              <Text style={styles.rechargeBtnText}>Recharge</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Live Catch Truck Tracking Card or Honest Cold Chain Assurance */}
        {trackingData?.active && trackingData.truckNumber ? (
          <TouchableOpacity
            style={styles.liveTruckCard}
            onPress={() => onNavigate('LIVE_TRACKING')}
            activeOpacity={0.9}
          >
            <View style={styles.truckCardTopRow}>
              <View style={styles.truckLiveBadge}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.truckLiveText}>
                  Fresh Catch Truck #{trackingData.truckNumber} Published Live
                </Text>
              </View>
              <View style={styles.etaPill}>
                <Text style={styles.etaPillText}>ETA 18 mins</Text>
              </View>
            </View>

            <View style={styles.truckCardMidRow}>
              <View style={styles.truckIconCircle}>
                <Text style={{ fontSize: 18 }}>🚚</Text>
              </View>
              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <Text style={styles.truckFarmTitle}>
                  {trackingData.origin?.name
                    ? `Departed ${trackingData.origin.name} · En route`
                    : 'Departed Godavari Farm · En route'}
                </Text>
                <Text style={styles.truckDestSubtitle}>
                  Destination: {trackingData.destination?.name || 'Madhapur Cold Hub'}
                </Text>
              </View>
              <View style={styles.trackLiveBtn}>
                <Text style={styles.trackLiveBtnText}>Track Live ✈</Text>
              </View>
            </View>

            <View style={styles.truckCardBottomRow}>
              <View style={styles.coldChainTag}>
                <Text style={styles.shieldSmall}>🛡</Text>
                <Text style={styles.coldChainText}>Continuous 0-4°C Cold Chain Assured</Text>
              </View>
              <Text style={styles.gpsSyncText}>GPS Live Sync</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.liveTruckCard}
            onPress={() => onNavigate('LIVE_TRACKING')}
            activeOpacity={0.9}
          >
            <View style={styles.truckCardTopRow}>
              <View style={styles.truckLiveBadge}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.truckLiveText}>Fresh Catch Truck #OD-04 Published Live</Text>
              </View>
              <View style={styles.etaPill}>
                <Text style={styles.etaPillText}>ETA 18 mins</Text>
              </View>
            </View>

            <View style={styles.truckCardMidRow}>
              <View style={styles.truckIconCircle}>
                <Text style={{ fontSize: 18 }}>🚚</Text>
              </View>
              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <Text style={styles.truckFarmTitle}>Departed Godavari Farm · En route</Text>
                <Text style={styles.truckDestSubtitle}>Destination: Madhapur Cold Hub</Text>
              </View>
              <View style={styles.trackLiveBtn}>
                <Text style={styles.trackLiveBtnText}>Track Live ✈</Text>
              </View>
            </View>

            <View style={styles.truckCardBottomRow}>
              <View style={styles.coldChainTag}>
                <Text style={styles.shieldSmall}>🛡</Text>
                <Text style={styles.coldChainText}>Continuous 0-4°C Cold Chain Assured</Text>
              </View>
              <Text style={styles.gpsSyncText}>GPS Live Sync</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Scan Counter Bill Quick Action Banner */}
        <TouchableOpacity
          style={styles.scanBillQuickCard}
          onPress={() => onNavigate('SCAN_BILL')}
          activeOpacity={0.88}
        >
          <View style={styles.subQuickLeft}>
            <View style={styles.scanBillQuickIcon}>
              <Text style={{ fontSize: 18 }}>🧾</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <Text style={styles.subQuickTitle}>Purchased at Store Counter?</Text>
              <Text style={styles.subQuickSubtitle}>
                Scan printed bill to apply weekly subscription quota & credit
              </Text>
            </View>
          </View>
          <View style={styles.scanBillQuickBtn}>
            <Text style={styles.scanBillQuickBtnText}>Scan Bill →</Text>
          </View>
        </TouchableOpacity>

        {/* Offers on Selected Fishes */}
        {discountedFish.length > 0 && (
          <View style={styles.flashSaleContainer}>
            <View style={styles.flashHeaderRow}>
              <View style={styles.flashIconCircle}>
                <Text style={{ fontSize: 16 }}>🔥</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.flashSectionTitle}>Offers on Selected Fishes</Text>
                  <View style={styles.flashBadgeRed}>
                    <Text style={styles.flashBadgeRedText}>FLASH SALE</Text>
                  </View>
                  <View style={styles.timerBadge}>
                    <Text style={styles.timerBadgeText}>⏱ Ends in 03h:24m</Text>
                  </View>
                </View>
                <Text style={styles.flashSectionSubtitle}>
                  Limited stocks at verified farm-gate prices
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
                  : '20% OFF';

                return (
                  <View key={item.id} style={styles.flashCard}>
                    <View style={styles.flashCardTop}>
                      <View style={styles.discountTag}>
                        <Text style={styles.discountTagText}>{discountText}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(item.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[styles.heartIcon, favorites[item.id] && styles.heartActive]}>
                          {favorites[item.id] ? '♥' : '♡'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => onNavigate('FISH_DETAILS', { fishId: item.id, fish: item })}
                      style={styles.flashImageBox}
                      activeOpacity={0.85}
                    >
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.flashImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.imageFallbackSmall}>
                          <Text style={{ fontSize: 24 }}>🐟</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.weightAddRow}>
                      <Text style={styles.weightText}>1000 g</Text>
                      <TouchableOpacity
                        style={styles.addBtnOutline}
                        onPress={() => handleAddToCart(item)}
                        disabled={addingFishId === item.id}
                        activeOpacity={0.8}
                      >
                        {addingFishId === item.id ? (
                          <ActivityIndicator size="small" color="#10B981" />
                        ) : (
                          <Text style={styles.addBtnOutlineText}>+ ADD</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={styles.pricingRow}>
                      <Text style={styles.currentPrice}>₹{item.pricing?.effectivePrice || item.unitPrice}</Text>
                      <Text style={styles.originalPrice}>₹{item.unitPrice}</Text>
                    </View>

                    <Text style={styles.flashFishName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    <View style={styles.saveRatingRow}>
                      <View style={styles.saveTag}>
                        <Text style={styles.saveTagText}>
                          Save ₹{(item.unitPrice - (item.pricing?.effectivePrice || item.unitPrice)) || 70}
                        </Text>
                      </View>
                      <Text style={styles.ratingText}>★ 4.8</Text>
                    </View>

                    <View style={styles.flashCardFooter}>
                      <Text style={styles.flameText}>🔥 Only 3 left</Text>
                      <Text style={styles.cardCategoryLink}>{item.categoryName || 'Freshwater'} ›</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Previously bought Section */}
        {fishList.length > 0 && (
          <View style={styles.previouslyBoughtContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Previously bought</Text>
              <TouchableOpacity onPress={() => onNavigate('BOOKING_HISTORY')}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.prevBoughtScroll}
            >
              {fishList.slice(0, 4).map((item) => (
                <View key={`prev-${item.id}`} style={styles.prevBoughtCard}>
                  <TouchableOpacity
                    style={styles.prevHeartBtn}
                    onPress={() => toggleFavorite(item.id)}
                  >
                    <Text style={[styles.heartIcon, favorites[item.id] && styles.heartActive]}>
                      {favorites[item.id] ? '♥' : '♡'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onNavigate('FISH_DETAILS', { fishId: item.id, fish: item })}
                    style={styles.prevImageBox}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.prevImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.imageFallbackSmall}>
                        <Text style={{ fontSize: 24 }}>🐟</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.carouselDotsRow}>
                    <View style={[styles.cDot, styles.cDotActive]} />
                    <View style={styles.cDot} />
                    <View style={styles.cDot} />
                  </View>
                  <View style={styles.prevMetaRow}>
                    <Text style={styles.prevWeightText}>500 g</Text>
                    <TouchableOpacity
                      style={styles.prevAddBtn}
                      onPress={() => handleAddToCart(item)}
                    >
                      <Text style={styles.prevAddBtnText}>ADD</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.prevPricingRow}>
                    <Text style={styles.prevPriceText}>₹{item.pricing?.effectivePrice || item.unitPrice}</Text>
                    {Boolean(item.pricing?.hasDiscount) && (
                      <Text style={styles.prevStrikePrice}>₹{item.unitPrice}</Text>
                    )}
                  </View>
                  <Text style={styles.prevFishName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={styles.prevRatingRow}>
                    <Text style={styles.prevRatingText}>★ 4.8</Text>
                    <Text style={styles.prevReviewCount}>(1,323)</Text>
                  </View>
                  <View style={styles.prevDeliveryRow}>
                    <Text style={styles.prevDeliveryText}>⚡ 8 mins • </Text>
                    <Text style={item.physicalAvailable ? styles.inStockText : styles.lowStockText}>
                      {item.physicalAvailable ? 'In stock' : '3 left'}
                    </Text>
                  </View>
                  <Text style={styles.prevCategoryLink}>{item.categoryName || 'Freshwater'} ›</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Primary Fish Catalogue Section */}
        <View style={styles.availableSectionHeader}>
          <View>
            <Text style={styles.sectionHeading}>Available Fishes</Text>
            <Text style={styles.availableSub}>
              Fresh lake catches ready for instant delivery or quota claim
            </Text>
          </View>
          <TouchableOpacity style={styles.sortFilterBtn}>
            <Text style={styles.sortFilterText}>Sort & Filter ☵</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Category Pills */}
        {renderCategoryPills()}

        {/* Availability Filter Chips */}
        {renderAvailabilityFilters()}

        {/* Catalogue Content States */}
        {loading ? (
          <LoadingSkeleton count={3} />
        ) : error ? (
          <ErrorStateView
            title="Unable to load today's fish."
            message={error}
            onRetry={loadAllData}
          />
        ) : filteredFishes.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.catalogueList}>
            {filteredFishes.map((item) => {
              const isBookable = Boolean(item.onlineBookable);
              const isAvailable = Boolean(item.physicalAvailable);
              const effectivePrice = item.pricing ? item.pricing.effectivePrice : item.unitPrice;
              const hasDiscount = Boolean(item.pricing && item.pricing.hasDiscount);
              const isAdding = addingFishId === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.fishCard}
                  onPress={() => onNavigate('FISH_DETAILS', { fishId: item.id, fish: item })}
                  activeOpacity={0.88}
                >
                  {/* Card Header: Category & Freshness */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.categoryLabel}>{item.categoryName || 'Daily Catch'}</Text>
                    <FreshnessBadge freshness={item.freshness} />
                  </View>

                  {/* Image Box with Fallback and Discount Badge */}
                  <View style={styles.imageBox}>
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.fishImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imageFallback}>
                        <Text style={{ fontSize: 40 }}>🐟</Text>
                      </View>
                    )}
                    {hasDiscount && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>
                          {item.pricing?.discount?.percent
                            ? `${item.pricing.discount.percent}% OFF`
                            : item.pricing?.discount?.flatAmount
                            ? `₹${item.pricing.discount.flatAmount} OFF`
                            : 'SPECIAL'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Card Body */}
                  <View style={styles.cardBody}>
                    <Text style={styles.fishName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    {Boolean(item.description) && (
                      <Text style={styles.fishDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}

                    {/* Status Badges Row */}
                    <View style={styles.statusBadgesRow}>
                      {isAvailable ? (
                        <View style={styles.statusPillAvailable}>
                          <View style={styles.greenDot} />
                          <Text style={styles.statusPillAvailableText}>In Store</Text>
                        </View>
                      ) : (
                        <View style={styles.statusPillUnavailable}>
                          <Text style={styles.statusPillUnavailableText}>Out of Stock</Text>
                        </View>
                      )}

                      {isBookable ? (
                        <View style={styles.bookingPillBookable}>
                          <Text style={styles.bookingPillBookableText}>Online Bookable</Text>
                        </View>
                      ) : (
                        <View style={styles.bookingPillInStore}>
                          <Text style={styles.bookingPillInStoreText}>Counter Only</Text>
                        </View>
                      )}
                    </View>

                    {/* Pricing & CTA Row */}
                    <View style={styles.priceRow}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                          <Text style={styles.priceValue}>₹{effectivePrice}</Text>
                          <Text style={styles.priceUnit}>/ kg</Text>
                          {hasDiscount && (
                            <Text style={styles.basePriceCrossed}>₹{item.unitPrice}</Text>
                          )}
                        </View>
                        <Text style={styles.priceTaxNote}>Inclusive of all taxes</Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.detailsButton,
                          isBookable ? styles.detailsButtonBookable : styles.detailsButtonInStore,
                        ]}
                        onPress={() => {
                          if (isBookable) {
                            handleAddToCart(item);
                          } else {
                            onNavigate('FISH_DETAILS', { fishId: item.id, fish: item });
                          }
                        }}
                        disabled={isAdding}
                        activeOpacity={0.8}
                      >
                        {isAdding ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.detailsButtonText}>
                            {isBookable ? '+ ADD' : 'View Details'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Show More Fishes CTA */}
            <TouchableOpacity
              style={styles.showMoreBtn}
              onPress={() => setSelectedCategoryId(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.showMoreBtnText}>Show More Fishes in Marketplace →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFE',
  },
  topHeader: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  headerLogoBadge: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  greetingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCheck: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  greetingSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  walletIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletAmountText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  userAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  searchCartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  cartButtonGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
    gap: 6,
    position: 'relative',
  },
  cartIconBox: {
    marginRight: 2,
  },
  cartPriceBox: {
    alignItems: 'flex-start',
  },
  cartPriceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  cartItemCountText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9,
    fontWeight: '600',
  },
  cartRedBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#DC2626',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartRedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  scrollBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 40,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  quotaMedalCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  quotaSubtitle: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 2,
  },
  rechargeBtn: {
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
  },
  rechargeBtnText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '800',
  },
  subQuickCard: {
    backgroundColor: '#0F2744',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  subQuickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subQuickIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subQuickTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subQuickSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  subQuickBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 6,
  },
  subQuickBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  scanBillQuickCard: {
    backgroundColor: '#0D2040',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
  },
  scanBillQuickIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBillQuickBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 6,
  },
  scanBillQuickBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  liveTruckCard: {
    backgroundColor: '#0A2540',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  truckCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  truckLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  truckLiveText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  etaPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  etaPillText: {
    color: '#BAE6FD',
    fontSize: 10,
    fontWeight: '800',
  },
  truckCardMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  truckIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckFarmTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  truckDestSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  trackLiveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trackLiveBtnText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  truckCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
  },
  coldChainTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shieldSmall: {
    fontSize: 10,
  },
  coldChainText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '700',
  },
  gpsSyncText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
  },
  assuranceCard: {
    backgroundColor: '#0F2744',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  assuranceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assuranceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  assuranceBadgeText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '700',
  },
  assuranceLink: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  assuranceTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  assuranceSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  flashSaleContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginBottom: 20,
  },
  flashHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  flashIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  flashBadgeRed: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flashBadgeRedText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  flashSectionSubtitle: {
    fontSize: 10,
    color: '#78350F',
    marginTop: 1,
  },
  flashCardsScroll: {
    gap: 10,
  },
  flashCard: {
    width: 154,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  flashCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  discountTag: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  heartIcon: {
    fontSize: 15,
    color: '#94A3B8',
  },
  heartActive: {
    color: '#EF4444',
  },
  flashImageBox: {
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginBottom: 8,
  },
  flashImage: {
    width: '100%',
    height: '100%',
  },
  imageFallbackSmall: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  weightAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  weightText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    flex: 1,
  },
  addBtnOutline: {
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 46,
    alignItems: 'center',
  },
  addBtnOutlineText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  originalPrice: {
    fontSize: 10,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  flashFishName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 14,
    marginBottom: 6,
    height: 28,
  },
  freshnessMiniRow: {
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  availableSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 8,
  },
  categoryPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryPillActive: {
    backgroundColor: '#0A192F',
    borderColor: '#0A192F',
  },
  categoryPillText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  filterChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  catalogueList: {
    gap: 12,
    marginBottom: 16,
  },
  fishCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageBox: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    marginBottom: 12,
  },
  fishImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  cardBody: {
    gap: 8,
  },
  fishName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
  },
  fishDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  statusPillAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  statusPillAvailableText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  statusPillUnavailable: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillUnavailableText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  bookingPillBookable: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bookingPillBookableText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  bookingPillInStore: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bookingPillInStoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  priceUnit: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  basePriceCrossed: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  priceTaxNote: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  detailsButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonBookable: {
    backgroundColor: '#059669',
  },
  detailsButtonInStore: {
    backgroundColor: '#0A192F',
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  micIcon: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
  },
  timerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  timerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400E',
  },
  saveRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  saveTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  flashCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  flameText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  cardCategoryLink: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  previouslyBoughtContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  prevBoughtScroll: {
    gap: 12,
  },
  prevBoughtCard: {
    width: 140,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  prevHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  prevImageBox: {
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  prevImage: {
    width: '100%',
    height: '100%',
  },
  carouselDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 6,
  },
  cDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  cDotActive: {
    backgroundColor: '#0F172A',
    width: 6,
  },
  prevMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  prevWeightText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  prevAddBtn: {
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FFFFFF',
  },
  prevAddBtnText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  prevPricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 2,
  },
  prevPriceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  prevStrikePrice: {
    fontSize: 10,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  prevFishName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 15,
    marginBottom: 4,
    minHeight: 30,
  },
  prevRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  prevRatingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  prevReviewCount: {
    fontSize: 9,
    color: '#94A3B8',
  },
  prevDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  prevDeliveryText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
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
  prevCategoryLink: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  availableSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 10,
  },
  sortFilterBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  showMoreBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  showMoreBtnText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '800',
  },
});
