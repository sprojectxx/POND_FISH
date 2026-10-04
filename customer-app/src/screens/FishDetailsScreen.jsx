/**
 * Screen: CP-04 — Fish Details
 * Traceability: PondFish Customer Mobile App UI Specification (Section 27-31)
 * Authoritative single fish view with live pricing, freshness details, availability,
 * online booking eligibility checks, quantity selection, and Add to Cart action.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import FreshnessBadge from '../components/FreshnessBadge';
import CartBadgeButton from '../components/CartBadgeButton';
import ErrorStateView from '../components/ErrorStateView';

export default function FishDetailsScreen({
  routeParams = {},
  onNavigate,
  cartCount = 0,
  onCartUpdated,
}) {
  const fishId = routeParams.fishId || routeParams.fish?.id;
  const initialFish = routeParams.fish || null;

  const [fish, setFish] = useState(initialFish);
  const [loading, setLoading] = useState(!initialFish);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1.0);
  const [error, setError] = useState(null);
  const [cartSuccessMessage, setCartSuccessMessage] = useState(null);

  const fetchDetails = useCallback(async () => {
    if (!fishId) return;
    try {
      setError(null);
      const res = await api.getFishDetails(fishId);
      if (res.data) {
        setFish(res.data);
      } else {
        throw new Error('Fish record not found.');
      }
    } catch (err) {
      console.error('[FISH DETAILS ERROR]', err.message);
      setError(err.message || 'Unable to load fish details.');
    } finally {
      setLoading(false);
    }
  }, [fishId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Adjust quantity with minimum 0.5 kg and max 100 kg
  function handleAdjustQty(delta) {
    setQuantity((prev) => {
      const next = parseFloat((prev + delta).toFixed(1));
      if (next < 0.5) return 0.5;
      if (next > 50) return 50;
      return next;
    });
    setCartSuccessMessage(null);
  }

  function handleSetQuickQty(val) {
    setQuantity(val);
    setCartSuccessMessage(null);
  }

  async function handleAddToCart() {
    if (!fish) return;
    setAddingToCart(true);
    setCartSuccessMessage(null);

    try {
      const result = await api.addToCart({
        fishId: fish.id,
        quantity,
      });

      if (onCartUpdated) {
        onCartUpdated(result.data);
      }

      setCartSuccessMessage(`Added ${quantity} kg of ${fish.name} to cart!`);
    } catch (err) {
      console.error('[ADD TO CART ERROR]', err.message);
      let msg = err.message || 'Could not add fish to cart.';
      if (err.code === 'FISH_NOT_ONLINE_BOOKABLE') {
        msg = 'Online booking is unavailable for this fish. In-store purchase only.';
      } else if (err.code === 'FISH_UNAVAILABLE') {
        msg = 'This fish is currently out of stock.';
      }
      alert(msg);
    } finally {
      setAddingToCart(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading fresh catch details...</Text>
      </View>
    );
  }

  if (error || !fish) {
    return (
      <View style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('MARKETPLACE')}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Fish Details</Text>
          <View style={{ width: 38 }} />
        </View>
        <ErrorStateView
          title="Unable to load fish details."
          message={error || 'This fish is no longer available.'}
          onRetry={fetchDetails}
        />
      </View>
    );
  }

  const effectivePrice = fish.pricing ? fish.pricing.effectivePrice : fish.unitPrice;
  const hasDiscount = fish.pricing && fish.pricing.hasDiscount;
  const isAvailable = Boolean(fish.physicalAvailable);
  const isBookable = Boolean(fish.onlineBookable);
  const subtotal = parseFloat((quantity * effectivePrice).toFixed(2));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* Top App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('MARKETPLACE')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle} numberOfLines={1}>
          {fish.name}
        </Text>
        <CartBadgeButton count={cartCount} onPress={() => onNavigate('CART')} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Fish Image */}
        <View style={styles.imageContainer}>
          {fish.imageUrl ? (
            <Image source={{ uri: fish.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={{ fontSize: 60 }}>🐟</Text>
            </View>
          )}

          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>
                {fish.pricing.discount?.percent ? `${fish.pricing.discount.percent}% OFF` : 'SPECIAL OFFER'}
              </Text>
            </View>
          )}
        </View>

        {/* Success Alert Banner */}
        {Boolean(cartSuccessMessage) && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>✓ {cartSuccessMessage}</Text>
            <TouchableOpacity style={styles.viewCartAction} onPress={() => onNavigate('CART')}>
              <Text style={styles.viewCartActionText}>View Cart →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Identity & Pricing Header */}
        <View style={styles.sectionCard}>
          <View style={styles.metaRow}>
            <Text style={styles.categoryBadge}>{fish.categoryName || 'Daily Catch'}</Text>
            <FreshnessBadge freshness={fish.freshness} />
          </View>

          <Text style={styles.titleText}>{fish.name}</Text>

          {/* Pricing Box */}
          <View style={styles.pricingContainer}>
            <View>
              <Text style={styles.priceLabel}>Applicable Counter Price</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={styles.priceValue}>₹{effectivePrice}</Text>
                <Text style={styles.priceUnit}>/ kg</Text>
                {hasDiscount && <Text style={styles.crossedPrice}>₹{fish.unitPrice}</Text>}
              </View>
            </View>
            {hasDiscount && (
              <View style={styles.savingsPill}>
                <Text style={styles.savingsText}>Save ₹{(fish.unitPrice - effectivePrice).toFixed(0)}/kg</Text>
              </View>
            )}
          </View>
        </View>

        {/* Availability & Online Booking Status Cards */}
        <View style={styles.statusGrid}>
          {/* Physical Availability Card */}
          <View style={[styles.statusBox, isAvailable ? styles.boxGreen : styles.boxRed]}>
            <Text style={styles.statusBoxIcon}>{isAvailable ? '🏪' : '🚫'}</Text>
            <Text style={styles.statusBoxTitle}>Store Availability</Text>
            <Text style={[styles.statusBoxSub, isAvailable ? styles.textGreen : styles.textRed]}>
              {isAvailable ? 'In Stock at Counter' : 'Currently Out of Stock'}
            </Text>
          </View>

          {/* Online Booking Eligibility Card */}
          <View style={[styles.statusBox, isBookable ? styles.boxBlue : styles.boxAmber]}>
            <Text style={styles.statusBoxIcon}>{isBookable ? '⚡' : '🔒'}</Text>
            <Text style={styles.statusBoxTitle}>Online Booking</Text>
            <Text style={[styles.statusBoxSub, isBookable ? styles.textBlue : styles.textAmber]}>
              {isBookable ? 'Eligible for Cart & Booking' : 'Counter Purchase Only'}
            </Text>
          </View>
        </View>

        {/* In-Store Only Notice if not online bookable */}
        {!isBookable && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>ℹ️ In-Store Purchase Only</Text>
            <Text style={styles.noticeText}>
              Online booking is currently unavailable for this catch due to cold-chain packing
              requirements. You can purchase this fish directly at our Bangalore Flagship Counter.
            </Text>
          </View>
        )}

        {/* Description & Cold Chain Assurance */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Description & Freshness</Text>
          <Text style={styles.bodyText}>
            {fish.description ||
              'Freshly harvested and transported under certified 0-4°C insulated chill containers.'}
          </Text>

          <View style={styles.guaranteeRow}>
            <View style={styles.guaranteeItem}>
              <Text style={styles.guaranteeIcon}>❄️</Text>
              <Text style={styles.guaranteeTitle}>0–4°C Ice Chilled</Text>
              <Text style={styles.guaranteeSub}>Continuous cold-chain</Text>
            </View>
            <View style={styles.guaranteeItem}>
              <Text style={styles.guaranteeIcon}>🔪</Text>
              <Text style={styles.guaranteeTitle}>Custom Clean & Cut</Text>
              <Text style={styles.guaranteeSub}>Done at pickup counter</Text>
            </View>
            <View style={styles.guaranteeItem}>
              <Text style={styles.guaranteeIcon}>🛡️</Text>
              <Text style={styles.guaranteeTitle}>100% Lake Harvest</Text>
              <Text style={styles.guaranteeSub}>Chemical-free guarantee</Text>
            </View>
          </View>
        </View>

        {/* Quantity Selection Card (Enabled only if bookable & available) */}
        {isBookable && isAvailable && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Select Quantity</Text>
            <Text style={styles.quantityNote}>All bookings are weighed in kilograms (kg).</Text>

            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => handleAdjustQty(-0.5)}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>

              <View style={styles.qtyDisplay}>
                <Text style={styles.qtyDisplayText}>{quantity.toFixed(1)}</Text>
                <Text style={styles.qtyDisplayUnit}>kg</Text>
              </View>

              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => handleAdjustQty(0.5)}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Select Chips */}
            <View style={styles.quickChipsRow}>
              {[1.0, 1.5, 2.0, 3.0, 5.0].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.quickChip, quantity === val && styles.quickChipActive]}
                  onPress={() => handleSetQuickQty(val)}
                >
                  <Text style={[styles.quickChipText, quantity === val && styles.quickChipTextActive]}>
                    {val} kg
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subtotal Calculation Box */}
            <View style={styles.subtotalBox}>
              <Text style={styles.subtotalLabel}>Estimated Subtotal ({quantity} kg)</Text>
              <Text style={styles.subtotalValue}>₹{subtotal}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        {isBookable && isAvailable ? (
          <TouchableOpacity
            style={[styles.ctaButton, addingToCart && styles.ctaButtonDisabled]}
            onPress={handleAddToCart}
            disabled={addingToCart}
            activeOpacity={0.8}
          >
            {addingToCart ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaButtonText}>Add to Cart • ₹{subtotal}</Text>
            )}
          </TouchableOpacity>
        ) : !isAvailable ? (
          <View style={[styles.ctaButton, styles.ctaButtonDisabled]}>
            <Text style={styles.ctaButtonTextDisabled}>Currently Out of Stock</Text>
          </View>
        ) : (
          <View style={[styles.ctaButton, styles.ctaButtonDisabled]}>
            <Text style={styles.ctaButtonTextDisabled}>In-Store Purchase Only</Text>
          </View>
        )}
      </View>
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
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginHorizontal: 12,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    height: 220,
    width: '100%',
    backgroundColor: colors.bgSurface,
    position: 'relative',
  },
  heroImage: {
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
    top: 14,
    left: 14,
    backgroundColor: colors.freshRed,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  successBanner: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.35)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  successBannerText: {
    color: colors.freshGreen,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  viewCartAction: {
    backgroundColor: colors.freshGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewCartActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  pricingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  priceUnit: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  crossedPrice: {
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  savingsPill: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsText: {
    color: colors.freshGreen,
    fontSize: 11,
    fontWeight: '700',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  statusBox: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  boxGreen: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderColor: 'rgba(22, 163, 74, 0.25)',
  },
  boxRed: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  boxBlue: {
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  boxAmber: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  statusBoxIcon: {
    fontSize: 18,
    marginBottom: 6,
  },
  statusBoxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  statusBoxSub: {
    fontSize: 12,
    fontWeight: '800',
  },
  textGreen: {
    color: colors.freshGreen,
  },
  textRed: {
    color: colors.freshRed,
  },
  textBlue: {
    color: colors.accent,
  },
  textAmber: {
    color: colors.warning,
  },
  noticeCard: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 14,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.warning,
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  guaranteeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  guaranteeItem: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
  },
  guaranteeIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  guaranteeTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  guaranteeSub: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
  },
  quantityNote: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 14,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  qtyDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  qtyDisplayText: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  qtyDisplayUnit: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  quickChipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderColor: colors.accent,
  },
  quickChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quickChipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  subtotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subtotalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.accent,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
  },
  ctaButton: {
    backgroundColor: colors.freshGreen,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  ctaButtonTextDisabled: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
