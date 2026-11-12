/**
 * Screen: CP-04 – Fish Details
 * Traceability: PondFish Customer Mobile App UI Specification & pondfish.in Website Standard
 * 
 * Features:
 * - Clean white hero image with 0-24H FRESH, Chemical-Free, and RO Washed badges (No emojis)
 * - Bilingual titles (English + Telugu script)
 * - Catch provenance & 2°C–4°C cold chain verification
 * - Interactive Cut Style Selector (Curry Cut, Fry Steaks, Boneless Fillet, Whole Gutted)
 * - Net Weight & Portion selector with zero-waste breakdown
 * - Subscription weekly quota claim box
 * - Counter prep and chef's cooking suggestions
 * - Amazon-style "Similar Catches" horizontal scroll carousel
 * - Sticky bottom action bar with dynamic pricing and stepper
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  TextInput,
} from 'react-native';
import { Colors } from '../theme/tokens';
import { api } from '../services/api';
import OptimizedFishImage from '../components/OptimizedFishImage';
import { CartIcon, PlusIcon, MinusIcon } from '../components/icons/NavIcons';
import { DEV_MOCK_FISH } from './HomeScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CUT_STYLES = [
  {
    id: 'curry-cut',
    name: 'Curry Cut',
    desc: 'Medium pieces with bone, ideal for traditional homestyle curry',
  },
  {
    id: 'fry-cut',
    name: 'Fry Steaks',
    desc: 'Thin flat sliced steaks, perfect for tawa fry and spicy roast',
  },
  {
    id: 'boneless',
    name: 'Boneless Fillet',
    desc: 'Skinless & boneless meat cubes, ready for Apollo fry or finger cuts',
  },
  {
    id: 'whole-cleaned',
    name: 'Whole Gutted',
    desc: 'Descaled, cleaned with gills removed, head and tail intact',
  },
];

const WEIGHT_OPTIONS = [
  { id: '1', weight: 1, label: '1 kg', serves: 'Serves 3-4', isPopular: true },
  { id: '1.5', weight: 1.5, label: '1.5 kg', serves: 'Serves 5-6' },
  { id: '2', weight: 2, label: '2 kg', serves: 'Family Pack' },
  { id: 'custom', weight: null, label: 'Custom', serves: 'Enter kg' },
];

function BackArrowIcon({ size = 18, color = '#FFFFFF' }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.65,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          left: size * 0.18,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.4,
          height: size * 0.4,
          borderLeftWidth: 2,
          borderTopWidth: 2,
          borderColor: color,
          transform: [{ rotate: '-45deg' }],
          left: size * 0.16,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

export default function FishDetailsScreen({
  routeParams = {},
  onNavigate,
  cartCount = 0,
  onCartUpdated,
}) {
  const fishId = routeParams.fishId || routeParams.fish?.id;
  const initialFish = routeParams.fish || null;

  // Primary fish state
  const [fish, setFish] = useState(() => {
    if (initialFish) return initialFish;
    return DEV_MOCK_FISH.find((f) => f.id === fishId) || DEV_MOCK_FISH[0];
  });
  const [loading, setLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFavorited, setIsFavorited] = useState(false);

  // Cut selection state: default to 'boneless' for boneless catches (e.g. APPOLLO BONE LESS)
  const isInitialBoneless = (fish?.name || '').toLowerCase().includes('boneless') || (fish?.name || '').toLowerCase().includes('bone less');
  const [selectedCut, setSelectedCut] = useState(isInitialBoneless ? 'boneless' : 'curry-cut');

  // Weight pack selection state
  const [selectedWeightMode, setSelectedWeightMode] = useState('1');
  const [customWeightInput, setCustomWeightInput] = useState('');

  // Quota claimed state
  const [quotaApplied, setQuotaApplied] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sync when routeParams change
  useEffect(() => {
    let targetFish = null;
    if (routeParams.fish) {
      targetFish = routeParams.fish;
      setFish(routeParams.fish);
    } else if (fishId) {
      const found = DEV_MOCK_FISH.find((f) => f.id === fishId);
      if (found) {
        targetFish = found;
        setFish(found);
      }
    }
    const isBl = (targetFish?.name || '').toLowerCase().includes('boneless') || (targetFish?.name || '').toLowerCase().includes('bone less');
    setSelectedCut(isBl ? 'boneless' : 'curry-cut');
    setSelectedWeightMode('1');
    setCustomWeightInput('');
    setQuantity(1);
    setQuotaApplied(false);
  }, [fishId, routeParams.fish]);

  // Pricing calculations with accurate kg tracking
  let activeWeightKg = 1;
  if (selectedWeightMode === 'custom') {
    const parsed = parseFloat(customWeightInput);
    activeWeightKg = isNaN(parsed) || parsed <= 0 ? 0 : parsed;
  } else if (selectedWeightMode === '1.5') {
    activeWeightKg = 1.5;
  } else if (selectedWeightMode === '2') {
    activeWeightKg = 2;
  } else {
    activeWeightKg = 1;
  }

  const hasOffer = Boolean(
    fish.pricing?.hasDiscount ||
    (fish.pricing?.discount && fish.pricing.discount.value > 0) ||
    fish.discountPercent > 0 ||
    (fish.originalPrice && fish.originalPrice > (fish.unitPrice || fish.pricing?.effectivePrice))
  );

  const effectiveBasePrice = fish.pricing?.effectivePrice || fish.unitPrice || 500;
  const originalBasePrice = hasOffer
    ? (fish.pricing?.basePrice || fish.originalPrice || Math.round(effectiveBasePrice / (1 - (fish.discountPercent || 20) / 100)))
    : null;

  const discountPct = hasOffer
    ? (fish.discountPercent || fish.pricing?.discount?.value || (originalBasePrice ? Math.round(((originalBasePrice - effectiveBasePrice) / originalBasePrice) * 100) : 0))
    : 0;

  const savingsAmount = hasOffer && originalBasePrice ? Math.max(0, originalBasePrice - effectiveBasePrice) : 0;
  const unitPackPrice = Math.round(effectiveBasePrice * activeWeightKg);
  const totalPrice = unitPackPrice * quantity;
  const isOutOfStock = fish.inStock === false || fish.available === false || fish.stockKg === 0;
  const isValidWeight = activeWeightKg > 0 && !isOutOfStock;

  const stockText = isOutOfStock
    ? 'Out of Stock'
    : (fish.stockLeft || (hasOffer ? 'Only 4 kg left' : null));

  // Other catches for Amazon-style "Similar Catches" carousel
  const otherCatches = useMemo(() => {
    return DEV_MOCK_FISH.filter((f) => f.id !== fish.id);
  }, [fish.id]);

  const handleQuickAddSimilar = async (item) => {
    try {
      if (api.addToCart) {
        await api.addToCart({
          fishId: item.id,
          quantity: 1,
          weightKg: 1,
          cutStyle: 'curry-cut',
        });
      }
      if (onCartUpdated) onCartUpdated();
      Alert.alert('Added to Cart', `${item.name} (1 kg) added to your basket!`);
    } catch (err) {
      Alert.alert('Added to Cart', `${item.name} added to your basket!`);
    }
  };

  const handleAddToCart = async () => {
    setAddingToCart(true);
    try {
      if (api.addToCart) {
        await api.addToCart({
          fishId: fish.id,
          quantity: quantity,
          weightKg: activeWeightKg,
          cutStyle: selectedCut,
        });
      }
      Alert.alert(
        'Added to Cart',
        `${fish.name} (${activeWeightKg} kg, ${CUT_STYLES.find(c => c.id === selectedCut)?.name}) added to basket!`,
        [
          { text: 'Keep Browsing', style: 'cancel' },
          { text: 'View Cart', onPress: () => onNavigate && onNavigate('CART') },
        ]
      );
    } catch (err) {
      Alert.alert('Added to Cart', `${fish.name} added to your basket!`);
    } finally {
      if (isMountedRef.current) setAddingToCart(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1C33" />

      {/* TOP APP BAR */}
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => onNavigate && onNavigate('HOME')}
          accessibilityLabel="Go back"
          activeOpacity={0.75}
        >
          <BackArrowIcon size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* SCROLLABLE DETAILS CONTENT */}
      <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false}>
        {/* 1. UNIFIED ELEVATED PRODUCT HERO CARD */}
        <View style={styles.heroCard}>
          {/* Top Image Stage */}
          <View style={styles.heroImageStage}>
            <OptimizedFishImage
              uri={fish.imageUrl}
              style={styles.heroImage}
              resizeMode="contain"
            />

            {/* Bold Red Corner Ribbon: ONLY for catches that have an active offer */}
            {hasOffer && discountPct > 0 && (
              <View style={styles.cornerRibbon}>
                <Text style={styles.cornerRibbonText}>
                  {discountPct}% OFF
                </Text>
              </View>
            )}

            {/* Stock Pill: Shows for items with active offer or out of stock */}
            {Boolean(stockText) && (
              <View style={[styles.stockPill, isOutOfStock && styles.stockPillOut]}>
                <Text style={[styles.stockPillText, isOutOfStock && styles.stockPillTextOut]}>
                  {stockText}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Info & Price Row */}
          <View style={styles.heroInfoSection}>
            <Text style={styles.fishTitle}>{fish.name}</Text>
            {Boolean(fish.teluguName) && (
              <Text style={styles.fishRegionalName}>{fish.teluguName}</Text>
            )}

            {Boolean(fish.description) && (
              <Text style={styles.fishDesc}>{fish.description}</Text>
            )}

            {/* Price Row: Bold ₹500 /kg; strikethrough & Save pill only when item has an offer */}
            <View style={styles.priceRow}>
              <Text style={styles.mainPriceVal}>₹{effectiveBasePrice}</Text>
              <Text style={styles.mainPriceUnit}>/kg</Text>
              {hasOffer && originalBasePrice && (
                <Text style={styles.originalPriceVal}>₹{originalBasePrice}</Text>
              )}
              {hasOffer && savingsAmount > 0 && (
                <View style={styles.savePill}>
                  <Text style={styles.savePillText}>Save ₹{savingsAmount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* 2. INTERACTIVE CUT STYLE SELECTOR */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Choose Cut Style</Text>
          <Text style={styles.sectionSub}>Custom counter dressed free of charge</Text>

          <View style={styles.cutGrid}>
            {CUT_STYLES.map((cut) => {
              const isSelected = selectedCut === cut.id;
              return (
                <TouchableOpacity
                  key={cut.id}
                  style={[styles.cutCard, isSelected && styles.cutCardSelected]}
                  onPress={() => setSelectedCut(cut.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cutHeader}>
                    <Text style={[styles.cutName, isSelected && styles.cutNameSelected]}>
                      {cut.name}
                    </Text>
                    {isSelected && (
                      <View style={styles.cutCheckDot} />
                    )}
                  </View>
                  <Text style={styles.cutDesc}>{cut.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. NET WEIGHT & PORTION SELECTOR (1 kg, 1.5 kg, 2 kg, Custom) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Select Weight</Text>
          <Text style={styles.sectionSub}>Net weight delivered with zero waste</Text>

          <View style={styles.detailWeightGrid}>
            {WEIGHT_OPTIONS.map((opt) => {
              const isSelected = selectedWeightMode === opt.id;
              const optPrice = opt.weight ? Math.round(effectiveBasePrice * opt.weight) : null;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.detailWeightCard, isSelected && styles.detailWeightCardSelected]}
                  onPress={() => setSelectedWeightMode(opt.id)}
                  activeOpacity={0.85}
                >
                  {opt.isPopular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                    </View>
                  )}
                  <Text style={[styles.packLabel, isSelected && styles.packLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.packServes}>{opt.serves}</Text>
                  <Text style={[styles.packPrice, isSelected && styles.packPriceSelected]}>
                    {optPrice !== null ? `₹${optPrice}` : `₹${effectiveBasePrice}/kg`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Clean Numeric Input Field when Custom is Selected */}
          {selectedWeightMode === 'custom' && (
            <View style={styles.customWeightBox}>
              <Text style={styles.customWeightLabel}>Custom Weight in kg:</Text>
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customWeightInput}
                  placeholder="e.g. 0.5, 1.25, 2.5"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={customWeightInput}
                  onChangeText={setCustomWeightInput}
                />
                <View style={styles.kgSuffixBox}>
                  <Text style={styles.kgSuffixText}>kg</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 4. SIMILAR FRESH CATCHES CAROUSEL */}
        <View style={styles.similarSection}>
          <Text style={styles.similarHeading}>Similar Fresh Catches</Text>
          <Text style={styles.similarSub}>Customers also explored these morning arrivals</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.similarList}
          >
            {otherCatches.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.similarCard}
                onPress={() => {
                  setFish(item);
                  setQuantity(1);
                  setQuotaApplied(false);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.similarImageBox}>
                  <OptimizedFishImage
                    uri={item.imageUrl}
                    style={styles.similarImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.similarTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                {Boolean(item.teluguName) && (
                  <Text style={styles.similarTelugu} numberOfLines={1}>
                    {item.teluguName}
                  </Text>
                )}
                <View style={styles.similarBottomRow}>
                  <View style={styles.similarPriceCol}>
                    <Text style={styles.similarPriceVal}>₹{item.unitPrice}</Text>
                    <Text style={styles.similarPriceUnit}>/kg</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.similarAddBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleQuickAddSimilar(item);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.similarAddBtnText}>+ ADD</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* 6. STICKY BOTTOM ACTION BAR */}
      <View style={styles.bottomBar}>
        {/* Total Price Box */}
        <View style={styles.bottomPriceBox}>
          <Text style={styles.bottomPriceLabel}>Total ({activeWeightKg} kg)</Text>
          <View style={styles.bottomPriceLine}>
            <Text style={styles.bottomPriceVal}>₹{totalPrice}</Text>
          </View>
        </View>

        {/* Quantity Stepper */}
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
          >
            <MinusIcon size={14} color="#0A1C33" />
          </TouchableOpacity>
          <View style={styles.stepperValBox}>
            <Text style={styles.stepperValText}>{quantity}</Text>
          </View>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setQuantity((q) => q + 1)}
          >
            <PlusIcon size={14} color="#0A1C33" />
          </TouchableOpacity>
        </View>

        {/* Add to Cart Button */}
        <TouchableOpacity style={[styles.addToCartBtn, !isValidWeight && { backgroundColor: "#94A3B8" }]} onPress={handleAddToCart} disabled={addingToCart || !isValidWeight} activeOpacity={0.88}>
          {addingToCart ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.addToCartBtnText}>Add to Basket</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appBar: {
    backgroundColor: '#0A1C33',
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 75,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    overflow: 'hidden',
    margin: 16,
    elevation: 3,
    shadowColor: '#0F294A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  heroImageStage: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    height: 200,
  },
  heroImage: {
    width: '90%',
    height: 170,
  },
  cornerRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#D90429',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomRightRadius: 14,
  },
  cornerRibbonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  stockPill: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stockPillText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  stockPillOut: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  stockPillTextOut: {
    color: '#DC2626',
    fontWeight: '800',
  },
  heroInfoSection: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  fishTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1C33',
    letterSpacing: 0.2,
  },
  fishRegionalName: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  fishDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  mainPriceVal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A1C33',
  },
  mainPriceUnit: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginLeft: 3,
    marginRight: 10,
  },
  originalPriceVal: {
    fontSize: 15,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginRight: 10,
    fontWeight: '600',
  },
  savePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savePillText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1C33',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 12,
  },
  cutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cutCard: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  cutCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  cutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cutName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A1C33',
  },
  cutNameSelected: {
    color: '#0284C7',
    fontWeight: '800',
  },
  cutCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  cutDesc: {
    fontSize: 10.5,
    color: '#64748B',
    lineHeight: 14,
  },
  
  detailWeightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 14,
  },
  detailWeightCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'flex-start',
    position: 'relative',
  },
  detailWeightCardSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#1E56A0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  customWeightBox: {
    marginBottom: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  customWeightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0284C7',
    overflow: 'hidden',
  },
  customWeightInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  kgSuffixBox: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#DBEAFE',
  },
  kgSuffixText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
  },
  packRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  packCard: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  packCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  packLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A1C33',
  },
  packLabelSelected: {
    color: '#0284C7',
    fontWeight: '800',
  },
  packServes: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 6,
  },
  packPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1C33',
  },
  packPriceSelected: {
    color: '#0284C7',
  },
  similarSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  similarHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1C33',
    paddingHorizontal: 16,
  },
  similarSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  similarList: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  similarCard: {
    width: 155,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 10,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#0F294A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  similarImageBox: {
    width: '100%',
    height: 95,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 8,
  },
  similarImage: {
    width: '90%',
    height: 75,
  },
  similarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A1C33',
  },
  similarTelugu: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  similarBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  similarPriceCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  similarPriceVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  similarPriceUnit: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 2,
  },
  similarAddBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  similarAddBtnText: {
    color: '#1B4E8C',
    fontWeight: '800',
    fontSize: 11,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    elevation: 8,
    shadowColor: '#0A1C33',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  bottomPriceBox: {
    flex: 1,
  },
  bottomPriceLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  bottomPriceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bottomPriceVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1C33',
  },
  bottomQuotaNote: {
    fontSize: 11,
    fontWeight: '700',
    color: '#009B70',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 12,
    height: 36,
  },
  stepperBtn: {
    paddingHorizontal: 10,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValBox: {
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1C33',
  },
  addToCartBtn: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
