/**
 * Screen: CP-03 — Fish Marketplace
 * Traceability: PondFish Customer Mobile App UI Specification (Section 24-26)
 * Browse live fish catalogue with search, category filtering, availability states,
 * freshness indicators, and navigation to Fish Details & Cart.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import FreshnessBadge from '../components/FreshnessBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyStateView from '../components/EmptyStateView';
import ErrorStateView from '../components/ErrorStateView';
import CartBadgeButton from '../components/CartBadgeButton';

export default function MarketplaceScreen({ onNavigate, cartCount = 0 }) {
  const [fishList, setFishList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null); // null = all
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL'); // 'ALL' | 'BOOKABLE' | 'IN_STORE'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load categories and initial catalogue
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [catsRes, fishRes] = await Promise.all([
        api.getCategories().catch(() => ({ data: [] })),
        api.getFish(),
      ]);

      setCategories(catsRes.data || []);
      setFishList(fishRes.data || []);
    } catch (err) {
      console.error('[MARKETPLACE LOAD ERROR]', err.message);
      setError(err.message || 'Unable to load today’s fish catalogue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Compute filtered list based on search, category, and availability
  const filteredFish = fishList.filter((item) => {
    // 1. Category Filter
    if (selectedCategory && item.categoryId !== selectedCategory) {
      return false;
    }

    // 2. Availability Filter
    if (availabilityFilter === 'BOOKABLE' && !item.onlineBookable) {
      return false;
    }
    if (availabilityFilter === 'IN_STORE' && (!item.physicalAvailable || item.onlineBookable)) {
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
            selectedCategory === null && styles.categoryPillActive,
          ]}
          onPress={() => setSelectedCategory(null)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.categoryPillText,
              selectedCategory === null && styles.categoryPillTextActive,
            ]}
          >
            All Fish
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(isActive ? null : cat.id)}
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

  function renderFishItem({ item }) {
    const isBookable = item.onlineBookable;
    const isAvailable = item.physicalAvailable;
    const effectivePrice = item.pricing ? item.pricing.effectivePrice : item.unitPrice;
    const hasDiscount = item.pricing && item.pricing.hasDiscount;

    return (
      <TouchableOpacity
        style={styles.fishCard}
        onPress={() => onNavigate('FISH_DETAILS', { fishId: item.id, fish: item })}
        activeOpacity={0.85}
      >
        {/* Card Header: Category & Freshness */}
        <View style={styles.cardHeader}>
          <Text style={styles.categoryLabel}>{item.categoryName || 'Daily Catch'}</Text>
          <FreshnessBadge freshness={item.freshness} />
        </View>

        {/* Fish Image / Visual Box */}
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

          {/* Discount Pill if active */}
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>
                {item.pricing.discount?.percent ? `${item.pricing.discount.percent}% OFF` : 'SPECIAL'}
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

          {/* Availability & Booking Badges */}
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
              onPress={() => onNavigate('FISH_DETAILS', { fishId: item.id, fish: item })}
              activeOpacity={0.8}
            >
              <Text style={styles.detailsButtonText}>
                {isBookable ? 'Reserve →' : 'View'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function renderEmpty() {
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

    if (selectedCategory) {
      return (
        <EmptyStateView
          emoji="🐟"
          title="No Fish in Category"
          message="No catch is currently listed under this category today."
          actionLabel="View All Categories"
          onAction={() => setSelectedCategory(null)}
        />
      );
    }

    return (
      <EmptyStateView
        emoji="🎣"
        title="No Fresh Fish Available Today"
        message="Our lake delivery has not replenished stock yet. Check back shortly."
        actionLabel="Refresh Catalogue"
        onAction={loadData}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => onNavigate('HOME')}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.appBarTitle}>Fish Marketplace</Text>
            <Text style={styles.appBarSubtitle}>Live Counter & Lake Harvest</Text>
          </View>
        </View>

        <CartBadgeButton count={cartCount} onPress={() => onNavigate('CART')} />
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search fish (e.g. Rohu, Bhetki, Prawns)..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
            >
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Category Chips */}
      {renderCategoryPills()}

      {/* Availability Filter Tabs */}
      {renderAvailabilityFilters()}

      {/* Main Fish List View */}
      {loading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <ErrorStateView
          title="Unable to load today's fish."
          message={error}
          onRetry={loadData}
        />
      ) : (
        <FlatList
          data={filteredFish}
          keyExtractor={(item) => item.id}
          renderItem={renderFishItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  appBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  appBarSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  clearSearchButton: {
    padding: 6,
  },
  clearSearchText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  categoryPillText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  fishCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageBox: {
    height: 150,
    width: '100%',
    backgroundColor: colors.bgSurface,
    position: 'relative',
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
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.freshRed,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardBody: {
    padding: 14,
  },
  fishName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  fishDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statusPillAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.freshGreen,
  },
  statusPillAvailableText: {
    fontSize: 10,
    color: colors.freshGreen,
    fontWeight: '700',
  },
  statusPillUnavailable: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillUnavailableText: {
    fontSize: 10,
    color: colors.freshRed,
    fontWeight: '700',
  },
  bookingPillBookable: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bookingPillBookableText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
  },
  bookingPillInStore: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bookingPillInStoreText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  priceUnit: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  basePriceCrossed: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  priceTaxNote: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailsButtonBookable: {
    backgroundColor: colors.primary,
  },
  detailsButtonInStore: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
