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
  Alert,
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
      Alert.alert('Unable to Add', msg);
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
          <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('HOME')}>
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
  const [selectedPackWeight, setSelectedPackWeight] = useState(1000);
  const [isFavorited, setIsFavorited] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.brandLogoImg}
            resizeMode="contain"
          />
          <Text style={styles.brandLogoText}>PondFish</Text>
          <Text style={styles.brandDivider}>|</Text>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {fish.name}
          </Text>
        </View>
        <View style={styles.appBarRight}>
          <TouchableOpacity style={styles.iconCircleBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 13, color: '#475569' }}>?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => onNavigate('PROFILE')}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, color: '#475569' }}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Fish Image with Overlaid Badges */}
        <View style={styles.imageContainer}>
          {fish.imageUrl ? (
            <Image source={{ uri: fish.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={{ fontSize: 60 }}>🐟</Text>
            </View>
          )}

          {/* Floating Top-Left 8 MINS Badge */}
          <View style={styles.minsBadge}>
            <Text style={styles.minsBadgeText}>⚡ 8 MINS</Text>
          </View>

          {/* Floating Top-Right Share and Heart Buttons */}
          <View style={styles.imageActionButtons}>
            <TouchableOpacity style={styles.imageActionBtn} activeOpacity={0.8}>
              <Text style={{ fontSize: 14 }}>↗</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.imageActionBtn}
              onPress={() => setIsFavorited((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 15, color: isFavorited ? '#EF4444' : '#475569' }}>
                {isFavorited ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Floating Bottom Trust Pills */}
          <View style={styles.imageBottomPills}>
            <View style={styles.trustPillNavy}>
              <Text style={styles.trustPillNavyText}>✓ 100% CHEMICAL-FREE</Text>
            </View>
            <View style={styles.trustPillWhite}>
              <Text style={styles.trustPillWhiteText}>💧 RO WASHED</Text>
            </View>
          </View>
        </View>

        {/* Carousel Dots */}
        <View style={styles.carouselDots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
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

        {/* Identity & Pricing Section */}
        <View style={styles.sectionCard}>
          <View style={styles.metaRow}>
            <View style={styles.topSellerBadge}>
              <Text style={styles.topSellerText}>⚙ TOP SELLER</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingStar}>★ 4.8</Text>
              <Text style={styles.ratingCount}>(1,323)</Text>
            </View>
          </View>

          <Text style={styles.titleText}>{fish.name} - Curry Cut (Large Steaks)</Text>
          <Text style={styles.specsText}>Net: 1000 g • Gross: 1250 g • 8-10 Pieces</Text>
          <Text style={styles.featureBullet}>
            ✓ Descaled, gutted & RO water cleansed • Zero waste
          </Text>

          {/* Pricing Box */}
          <View style={styles.priceRowLarge}>
            <Text style={styles.priceValueLarge}>₹{effectivePrice}</Text>
            {hasDiscount && <Text style={styles.crossedPriceLarge}>₹{fish.unitPrice}</Text>}
            <View style={styles.discountPillGreen}>
              <Text style={styles.discountPillGreenText}>
                {fish.pricing?.discount?.percent ? `${fish.pricing.discount.percent}% OFF` : '20% OFF'}
              </Text>
            </View>
          </View>
        </View>

        {/* Subscription Quota Card (Deep Navy) */}
        <View style={styles.quotaNavyCard}>
          <View style={styles.quotaNavyTop}>
            <View style={styles.quotaNavyLeft}>
              <View style={styles.goldMedalBox}>
                <Text style={{ fontSize: 16 }}>🎖</Text>
              </View>
              <Text style={styles.quotaNavyBrand}>PONDFISH GOLD</Text>
              <View style={styles.activePlanBadge}>
                <Text style={styles.activePlanText}>ACTIVE PLAN</Text>
              </View>
            </View>
            <Text style={styles.quotaNavyRemaining}>0.6 kg left</Text>
          </View>

          <Text style={styles.quotaClaimText}>
            Claim 500g under today's weekly quota for <Text style={{ color: '#FBBF24', fontWeight: '800' }}>₹0 extra !</Text>
          </Text>

          <View style={styles.quotaNavyBottom}>
            <TouchableOpacity
              style={styles.applyQuotaBtn}
              onPress={() => onNavigate('SUBSCRIPTION')}
              activeOpacity={0.88}
            >
              <Text style={styles.applyQuotaBtnText}>Apply Quota Allowance →</Text>
            </TouchableOpacity>
            <Text style={styles.weeklyLimitText}>Weekly fresh limit</Text>
          </View>
        </View>

        {/* Pack Weight Selector */}
        <View style={styles.sectionCard}>
          <View style={styles.packHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Pack Weight</Text>
            <Text style={styles.netWeightHint}>Net Clean Weight</Text>
          </View>

          <View style={styles.packOptionsRow}>
            {/* 500g */}
            <TouchableOpacity
              style={[
                styles.packBox,
                selectedPackWeight === 500 && styles.packBoxSelected,
              ]}
              onPress={() => {
                setSelectedPackWeight(500);
                setQuantity(0.5);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.packWeightNum}>500 g</Text>
              <Text style={styles.packSteaksHint}>3-4 Steaks</Text>
              <Text style={styles.packPriceText}>₹{Math.round(effectivePrice * 0.5) || 150}</Text>
            </TouchableOpacity>

            {/* 1000g Popular */}
            <TouchableOpacity
              style={[
                styles.packBox,
                selectedPackWeight === 1000 && styles.packBoxSelected,
              ]}
              onPress={() => {
                setSelectedPackWeight(1000);
                setQuantity(1.0);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>POPULAR</Text>
              </View>
              <Text style={styles.packWeightNum}>1000 g</Text>
              <Text style={styles.packSteaksHint}>8-10 Steaks</Text>
              <Text style={styles.packPriceText}>₹{effectivePrice || 280}</Text>
            </TouchableOpacity>

            {/* 1500g */}
            <TouchableOpacity
              style={[
                styles.packBox,
                selectedPackWeight === 1500 && styles.packBoxSelected,
              ]}
              onPress={() => {
                setSelectedPackWeight(1500);
                setQuantity(1.5);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.packWeightNum}>1500 g</Text>
              <Text style={styles.packSteaksHint}>14-16 Steaks</Text>
              <Text style={styles.packPriceText}>₹{Math.round(effectivePrice * 1.5) || 410}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Frequently Bought Together */}
        <View style={styles.sectionCard}>
          <View style={styles.packHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Frequently Bought Together</Text>
            <TouchableOpacity onPress={() => onNavigate('HOME')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
            {/* Card 1 */}
            <View style={styles.freqCard}>
              <View style={styles.freqTag}>
                <Text style={styles.freqTagText}>FRESH</Text>
              </View>
              <View style={styles.freqImageBox}>
                <Text style={{ fontSize: 30 }}>🦐</Text>
              </View>
              <Text style={styles.freqTitle}>Fresh Tiger Prawns</Text>
              <Text style={styles.freqSubtitle}>250g • Cleaned</Text>
              <View style={styles.freqBottomRow}>
                <Text style={styles.freqPrice}>₹210</Text>
                <TouchableOpacity style={styles.freqAddBtn}>
                  <Text style={styles.freqAddBtnText}>+ ADD</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Card 2 */}
            <View style={styles.freqCard}>
              <View style={[styles.freqTag, { backgroundColor: '#0284C7' }]}>
                <Text style={styles.freqTagText}>POPULAR</Text>
              </View>
              <View style={styles.freqImageBox}>
                <Text style={{ fontSize: 30 }}>🐟</Text>
              </View>
              <Text style={styles.freqTitle}>Fresh Catla Steaks</Text>
              <Text style={styles.freqSubtitle}>500g • Large</Text>
              <View style={styles.freqBottomRow}>
                <Text style={styles.freqPrice}>₹175</Text>
                <TouchableOpacity style={styles.freqAddBtn}>
                  <Text style={styles.freqAddBtnText}>+ ADD</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Card 3 */}
            <View style={styles.freqCard}>
              <View style={[styles.freqTag, { backgroundColor: '#7C3AED' }]}>
                <Text style={styles.freqTagText}>PREMIUM</Text>
              </View>
              <View style={styles.freqImageBox}>
                <Text style={{ fontSize: 30 }}>🥩</Text>
              </View>
              <Text style={styles.freqTitle}>Rawas Boneless</Text>
              <Text style={styles.freqSubtitle}>300g • Cubes</Text>
              <View style={styles.freqBottomRow}>
                <Text style={styles.freqPrice}>₹380</Text>
                <TouchableOpacity style={styles.freqAddBtn}>
                  <Text style={styles.freqAddBtnText}>+ ADD</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarLeft}>
          <View style={styles.bottomPriceRow}>
            <Text style={styles.bottomPriceValue}>₹{subtotal}</Text>
            {hasDiscount && (
              <Text style={styles.bottomCrossedPrice}>₹{Math.round(subtotal * 1.25)}</Text>
            )}
            <View style={styles.bottomDiscountBadge}>
              <Text style={styles.bottomDiscountText}>20% OFF</Text>
            </View>
          </View>
          <Text style={styles.bottomSubtext}>• Standard Cut • {selectedPackWeight}g</Text>
        </View>

        {/* Stepper */}
        <View style={styles.stepperBox}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleAdjustQty(-0.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValText}>{quantity.toFixed(1)}</Text>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleAdjustQty(0.5)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Add to Cart Button */}
        {isBookable && isAvailable ? (
          <TouchableOpacity
            style={[styles.addToCartBtn, addingToCart && styles.addToCartBtnDisabled]}
            onPress={handleAddToCart}
            disabled={addingToCart}
            activeOpacity={0.88}
          >
            {addingToCart ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={{ fontSize: 16, marginRight: 6 }}>🛍</Text>
                <Text style={styles.addToCartBtnText}>Add to Cart</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.addToCartBtn, styles.addToCartBtnDisabled]}>
            <Text style={styles.addToCartBtnText}>
              {!isAvailable ? 'Out of Stock' : 'In-Store Only'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFE',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 13,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: '#0A1C33',
    fontWeight: '700',
  },
  appBarCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  brandLogoImg: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  brandLogoText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1C33',
  },
  brandDivider: {
    color: '#94A3B8',
    marginHorizontal: 6,
  },
  appBarTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  imageContainer: {
    height: 250,
    width: '100%',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#EDF5FD',
  },
  minsBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: '#0A1C33',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  minsBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  imageActionButtons: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
  },
  imageActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageBottomPills: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    gap: 8,
  },
  trustPillNavy: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trustPillNavyText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  trustPillWhite: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trustPillWhiteText: {
    color: '#0A1C33',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginVertical: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    backgroundColor: '#0A1C33',
    width: 14,
  },
  successBanner: {
    margin: 14,
    marginBottom: 0,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  successBannerText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  viewCartAction: {
    backgroundColor: '#16A34A',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topSellerBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  topSellerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStar: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  ratingCount: {
    fontSize: 11,
    color: '#64748B',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1C33',
    lineHeight: 22,
    marginBottom: 6,
  },
  specsText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  featureBullet: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 12,
  },
  priceRowLarge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  priceValueLarge: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0A1C33',
  },
  crossedPriceLarge: {
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  discountPillGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discountPillGreenText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800',
  },
  quotaNavyCard: {
    backgroundColor: '#0A1C33',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 12,
  },
  quotaNavyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaNavyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goldMedalBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaNavyBrand: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activePlanBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePlanText: {
    color: '#0A1C33',
    fontSize: 9,
    fontWeight: '900',
  },
  quotaNavyRemaining: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  quotaClaimText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  quotaNavyBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applyQuotaBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyQuotaBtnText: {
    color: '#0A1C33',
    fontSize: 12,
    fontWeight: '800',
  },
  weeklyLimitText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  packHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1C33',
  },
  netWeightHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  packOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  packBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    position: 'relative',
  },
  packBoxSelected: {
    borderColor: '#0A1C33',
    backgroundColor: '#FFFFFF',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#0A1C33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  packWeightNum: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1C33',
    marginBottom: 2,
  },
  packSteaksHint: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 6,
  },
  packPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  freqCard: {
    width: 130,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  freqTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  freqTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  freqImageBox: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 6,
  },
  freqTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1C33',
    lineHeight: 15,
  },
  freqSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginVertical: 2,
  },
  freqBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  freqPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1C33',
  },
  freqAddBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  freqAddBtnText: {
    color: '#0284C7',
    fontSize: 10,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomBarLeft: {
    flex: 1,
  },
  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bottomPriceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1C33',
  },
  bottomCrossedPrice: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  bottomDiscountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bottomDiscountText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  bottomSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginRight: 10,
    gap: 8,
  },
  stepperBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0284C7',
  },
  stepperValText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1C33',
    minWidth: 20,
    textAlign: 'center',
  },
  addToCartBtn: {
    backgroundColor: '#0A1C33',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addToCartBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  addToCartBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
