/**
 * Screen: CP-05 — Customer Cart
 * Traceability: PondFish Customer Mobile App UI Specification (Section 32-33)
 * Authoritative cart view with item listing, quantity stepper, item removal,
 * empty state, order summary calculation, backend revalidation, and checkout eligibility enforcement.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import EmptyStateView from '../components/EmptyStateView';
import ErrorStateView from '../components/ErrorStateView';

export default function CartScreen({ onNavigate, onCartUpdated }) {
  const [cart, setCart] = useState({
    items: [],
    summary: { totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true },
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [error, setError] = useState(null);

  // Authoritative server-side cart retrieval
  const fetchCart = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getCart();
      const cartData = res.data || {
        items: [],
        summary: { totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true },
      };
      setCart(cartData);
      if (onCartUpdated) {
        onCartUpdated(cartData);
      }
    } catch (err) {
      console.error('[CART FETCH ERROR]', err.message);
      setError(err.message || 'Unable to load your cart.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onCartUpdated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCart();
  }, [fetchCart]);

  // Stepper mutation with range bounds and state rollback on failure
  async function handleUpdateQty(item, delta) {
    if (updatingItemId) return; // Prevent concurrent mutations

    const currentQty = item.quantity;
    const nextQty = parseFloat((currentQty + delta).toFixed(1));

    if (nextQty > 100) {
      Alert.alert('Quantity Limit', 'Maximum quantity per fish item is 100 kg.');
      return;
    }

    // If decreasing to 0 or below, confirm removal
    if (nextQty <= 0) {
      Alert.alert(
        'Remove Item',
        `Remove ${item.name} from your cart?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => handleRemoveItem(item.fishId),
          },
        ]
      );
      return;
    }

    const previousCart = cart;
    setUpdatingItemId(item.fishId);

    try {
      const res = await api.updateCartQuantity({ fishId: item.fishId, quantity: nextQty });
      const cartData = res.data || { items: [], summary: {} };
      setCart(cartData);
      if (onCartUpdated) {
        onCartUpdated(cartData);
      }
    } catch (err) {
      console.error('[UPDATE CART ERROR]', err.message);
      // Restore confirmed state
      setCart(previousCart);
      Alert.alert('Update Failed', err.message || 'Could not update item quantity.');
    } finally {
      setUpdatingItemId(null);
    }
  }

  // Authoritative item removal with state rollback on failure
  async function handleRemoveItem(fishId) {
    if (updatingItemId) return;

    const previousCart = cart;
    setUpdatingItemId(fishId);

    try {
      const res = await api.removeFromCart(fishId);
      const cartData = res.data || {
        items: [],
        summary: { totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true },
      };
      setCart(cartData);
      if (onCartUpdated) {
        onCartUpdated(cartData);
      }
    } catch (err) {
      console.error('[REMOVE CART ERROR]', err.message);
      setCart(previousCart);
      Alert.alert('Removal Failed', err.message || 'Could not remove item from cart.');
    } finally {
      setUpdatingItemId(null);
    }
  }

  // Clear all items with confirmation
  function handleClearCart() {
    if (updatingItemId || loading) return;

    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await api.clearCart();
              const cartData = res.data || {
                items: [],
                summary: { totalItems: 0, totalQuantity: 0, totalAmount: 0, isAllBookable: true },
              };
              setCart(cartData);
              if (onCartUpdated) {
                onCartUpdated(cartData);
              }
            } catch (err) {
              console.error('[CLEAR CART ERROR]', err.message);
              Alert.alert('Clear Cart Failed', err.message || 'Could not clear cart.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  // Check whether all items are eligible for online booking
  const hasIneligibleItems = cart.items.some(
    (item) => !item.physicalAvailable || !item.onlineBookable
  );
  const isCheckoutEligible = cart.items.length > 0 && !hasIneligibleItems && (cart.summary?.isAllBookable !== false);

  function renderCartItem({ item }) {
    const isBusy = updatingItemId === item.fishId;
    const isMutatingAny = Boolean(updatingItemId);
    const hasWarning = Boolean(item.availabilityWarning || item.bookingWarning);

    return (
      <View style={styles.itemCard}>
        {/* Item Content Row */}
        <View style={styles.itemTopRow}>
          {/* Thumbnail */}
          <View style={styles.itemThumb}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 24 }}>🐟</Text>
            )}
          </View>

          {/* Details */}
          <View style={styles.itemInfo}>
            <Text style={styles.itemCategory}>{item.categoryName || 'Daily Catch'}</Text>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <Text style={styles.itemPrice}>₹{item.effectivePrice}/kg</Text>
              {item.hasDiscount && (
                <Text style={styles.itemCrossedPrice}>₹{item.unitPrice}</Text>
              )}
            </View>
          </View>

          {/* Remove Button with confirmation prompt */}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => {
              Alert.alert(
                'Remove Item',
                `Remove ${item.name} from your cart?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => handleRemoveItem(item.fishId),
                  },
                ]
              );
            }}
            disabled={isMutatingAny}
            activeOpacity={0.7}
          >
            <Text style={styles.removeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Warning Banner if item status changed on backend */}
        {hasWarning && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningBannerText}>
              ⚠️ {item.availabilityWarning || item.bookingWarning}
            </Text>
          </View>
        )}

        {/* Footer: Stepper & Subtotal */}
        <View style={styles.itemFooter}>
          {/* Stepper */}
          <View style={styles.stepperBox}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => handleUpdateQty(item, -0.5)}
              disabled={isMutatingAny}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>

            <View style={styles.stepValueBox}>
              {isBusy ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.stepValueText}>{item.quantity} kg</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => handleUpdateQty(item, 0.5)}
              disabled={isMutatingAny}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Subtotal */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.subtotalLabel}>Item Subtotal</Text>
            <Text style={styles.subtotalValue}>₹{item.subtotal}</Text>
          </View>
        </View>
      </View>
    );
  }

  function renderSummary() {
    const { totalItems = 0, totalQuantity = 0, totalAmount = 0 } = cart.summary || {};

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Order Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Items</Text>
          <Text style={styles.summaryValue}>{totalItems} varieties</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Net Weight</Text>
          <Text style={styles.summaryValue}>{totalQuantity} kg</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Cold-Chain Packaging</Text>
          <Text style={[styles.summaryValue, { color: colors.freshGreen }]}>Free</Text>
        </View>

        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Estimated Total</Text>
          <Text style={styles.totalValue}>₹{totalAmount}</Text>
        </View>

        <View style={styles.authoritativeNote}>
          <Text style={styles.authoritativeNoteText}>
            🔒 Authoritative pricing verified by PondFish backend. Weighed precisely at counter pickup.
          </Text>
        </View>

        {/* Ineligible Items Alert Banner */}
        {hasIneligibleItems && (
          <View style={styles.ineligibleBanner}>
            <Text style={styles.ineligibleBannerTitle}>⚠️ Ineligible Items for Online Reservation</Text>
            <Text style={styles.ineligibleBannerText}>
              One or more items in your cart are currently out of stock or available for in-store counter pickup only. Please remove ineligible items to proceed to checkout.
            </Text>
          </View>
        )}

        {/* Proceed to Checkout with Eligibility Guard */}
        <TouchableOpacity
          style={[
            styles.checkoutButton,
            !isCheckoutEligible && styles.checkoutButtonDisabled,
          ]}
          onPress={() => {
            if (!isCheckoutEligible) {
              Alert.alert(
                'Ineligible Items',
                'Please remove out-of-stock or counter-only items from your cart before proceeding to checkout.'
              );
              return;
            }
            onNavigate('CHECKOUT');
          }}
          disabled={Boolean(updatingItemId)}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutButtonText}>
            {isCheckoutEligible
              ? 'Review & Proceed to Booking →'
              : 'Remove Ineligible Items to Checkout'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.continueButtonText}>← Add More Fresh Catch</Text>
        </TouchableOpacity>
      </View>
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
            <Text style={styles.appBarTitle}>Your Cart</Text>
            <Text style={styles.appBarSubtitle}>
              {cart.items.length} {cart.items.length === 1 ? 'item' : 'items'} reserved
            </Text>
          </View>
        </View>

        {cart.items.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearCart}
            disabled={Boolean(updatingItemId)}
          >
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Validating cart with backend...</Text>
        </View>
      ) : error ? (
        <ErrorStateView title="Unable to load cart" message={error} onRetry={fetchCart} />
      ) : cart.items.length === 0 ? (
        <EmptyStateView
          emoji="🛒"
          title="Your cart is empty"
          message="Explore today’s lake harvest and reserve premium fish for store pickup."
          actionLabel="Browse Today’s Catch"
          onAction={() => onNavigate('HOME')}
        />
      ) : (
        <FlatList
          data={cart.items}
          keyExtractor={(item) => item.fishId}
          renderItem={renderCartItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderSummary}
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 13,
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
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.freshRed,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  itemCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemThumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
  },
  itemCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  itemCrossedPrice: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '700',
  },
  warningBanner: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  warningBannerText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.4)',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stepValueBox: {
    paddingHorizontal: 12,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtotalLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.accent,
  },
  summaryCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.freshGreen,
  },
  authoritativeNote: {
    backgroundColor: colors.bgSurface,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  authoritativeNoteText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  ineligibleBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  ineligibleBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.freshRed,
    marginBottom: 4,
  },
  ineligibleBannerText: {
    fontSize: 11,
    color: '#F87171',
    lineHeight: 15,
  },
  checkoutButton: {
    backgroundColor: colors.freshGreen,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#475569',
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  continueButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
