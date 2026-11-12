/**
 * Screen: CP-02 – Customer Home Dashboard & Primary Fish Catalogue
 * Traceability: PondFish Customer Mobile App UI Specification & pondfish.in Website Standard
 * 
 * Features:
 * - Clean White Website-Style Header with Horizontal PondFish Logo Image
 * - Location & Subscription Balance Header (₹1,500)
 * - Search bar with instant filtering
 * - Special Offers Carousel with VERTICAL CARDS (matching fish card size & flashy highlights)
 * - Professional Filter button (No AI gear icons) with Slide-up Bottom Sheet Modal
 * - Grouped 2-column fish catalogue with clean small category headings (No emojis)
 * - Flashy Red Strikethrough & Savings Tag on Discounted Fish Cards
 * - Pure white canvas & bilingual script
 * - Sticky Cart Bar
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  Image,
  Keyboard,
} from 'react-native';
import { Colors, Radii } from '../theme/tokens';
import { api } from '../services/api';
import FishCard from '../components/FishCard';
import OptimizedFishImage from '../components/OptimizedFishImage';
import { SearchIcon, LocationPinIcon, CartIcon, PlusIcon, MinusIcon } from '../components/icons/NavIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Cloudflare Edge Cache CDN Base ($0 egress / unlimited bandwidth)
const FISH_CDN_BASE = "https://pondfish-cdn.sprojectxx.workers.dev/fish-assets";

// Flashy highlighted offer catches (vertical cards matching fish card proportions)
const HIGHLIGHTED_OFFERS = [
  {
    id: "offer-apollo",
    fishId: "e6fd568d-7667-4d11-912e-a36e062ab716",
    name: "APPOLLO BONE LESS",
    teluguName: "అపోలో బోన్‌లెస్",
    description: "Skinless, boneless fillets cleanly prepped for Apollo fish fry and finger cuts.",
    imageUrl: `${FISH_CDN_BASE}/apollo-boneless.webp`,
    categoryName: "Freshwater Fish",
    unitPrice: 500,
    originalPrice: 625,
    discountPercent: 20,
    savings: 125,
    dealTag: "FLASH DEAL",
    urgencyText: "Only 4 kg left today",
    claimedPercent: 82,
    stockLeft: "Only 4 kg left",
    endsIn: "02h 15m",
  },
  {
    id: "offer-bochu",
    fishId: "44444444-4444-4444-a444-444444444444",
    name: "BOCHE (KATLA)",
    teluguName: "బొచ్చె (కట్ల)",
    description: "Freshwater Catla (Bocche). Large center cuts and round steaks for pulusu.",
    imageUrl: `${FISH_CDN_BASE}/bochu.webp`,
    categoryName: "Freshwater Fish",
    unitPrice: 240,
    originalPrice: 300,
    discountPercent: 20,
    savings: 60,
    dealTag: "COUNTER SPECIAL",
    urgencyText: "Morning pond harvest",
    claimedPercent: 68,
    stockLeft: "Only 7 kg left",
    endsIn: "03h 40m",
  },
  {
    id: "offer-prawns",
    fishId: "55555555-5555-4555-a555-555555555555",
    name: "TIGER PRAWNS",
    teluguName: "రొయ్యలు (టైగర్)",
    description: "Premium jumbo Tiger Prawns. Giant succulent crustaceans.",
    imageUrl: `${FISH_CDN_BASE}/tiger-prawns.webp`,
    categoryName: "Shellfish & Prawns",
    unitPrice: 999,
    originalPrice: 1250,
    discountPercent: 20,
    savings: 251,
    dealTag: "SPECIAL CATCH",
    urgencyText: "Live coast arrival",
    claimedPercent: 91,
    stockLeft: "Only 2 kg left",
    endsIn: "01h 10m",
  },
  {
    id: "offer-tilapia",
    fishId: "66666666-6666-4666-a666-666666666666",
    name: "TILAPIA WHOLE",
    teluguName: "తిలాపియా",
    description: "Whole farm-fresh Tilapia. Descaled and cleaned whole with head on.",
    imageUrl: `${FISH_CDN_BASE}/tilapia-whole-fish.webp`,
    categoryName: "Freshwater Fish",
    unitPrice: 150,
    originalPrice: 200,
    discountPercent: 25,
    savings: 50,
    dealTag: "SUPER SAVER",
    urgencyText: "Cleaned whole",
    claimedPercent: 74,
    stockLeft: "Only 5 kg left",
    endsIn: "04h 25m",
  },
];

export const DEV_MOCK_FISH = [
  {
    id: "e6fd568d-7667-4d11-912e-a36e062ab716",
    name: "APPOLLO BONE LESS",
    teluguName: "అపోలో బోన్‌లెస్",
    description: "Skinless, boneless fillets cleanly prepped for Apollo fish fry and finger cuts.",
    imageUrl: `${FISH_CDN_BASE}/apollo-boneless.webp`,
    categoryName: "Freshwater Fish",
    unitPrice: 500,
    unitBasis: "Net 1000g · Gross 1250g",
    pricing: {
      basePrice: 625,
      effectivePrice: 500,
      hasDiscount: true,
      discount: { type: 'PERCENTAGE', value: 20, savings: 125 },
    },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 5:30 AM",
    waterSource: "Inland Freshwater Pond",
  },
  {
    id: "44444444-4444-4444-a444-444444444444",
    name: "BOCHE (Katla)",
    teluguName: "బొచ్చె (కట్ల)",
    description: "Freshwater Catla (Bocche). Large center cuts and round steaks for pulusu.",
    imageUrl: `${FISH_CDN_BASE}/bochu.webp`,
    categoryName: "Freshwater Fish",
    unitPrice: 240,
    unitBasis: "Net 1000g · Gross 1300g",
    originalPrice: 300,
    discountPercent: 20,
    stockLeft: "Only 7 kg left",
    pricing: {
      basePrice: 300,
      effectivePrice: 240,
      hasDiscount: true,
      discount: { type: 'PERCENTAGE', value: 20, savings: 60 },
    },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 5:00 AM",
    waterSource: "Krishna River Inland Tank",
  },
  {
    id: "66666666-6666-4666-a666-666666666666",
    name: "TILAPIA WHOLE FISH",
    teluguName: "తిలాపియా",
    description: "Whole farm-fresh Tilapia. Descaled and cleaned whole with head on.",
    imageUrl: `${FISH_CDN_BASE}/tilapia-whole-fish.webp`,
    categoryName: "Freshwater Fish",
    unitPrice: 150,
    unitBasis: "Net 1000g · Gross 1200g",
    originalPrice: 200,
    discountPercent: 25,
    stockLeft: "Only 5 kg left",
    pricing: {
      basePrice: 200,
      effectivePrice: 150,
      hasDiscount: true,
      discount: { type: 'PERCENTAGE', value: 25, savings: 50 },
    },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 6:00 AM",
    waterSource: "Controlled Inland Aquaculture",
  },
  {
    id: "22222222-2222-4222-a222-222222222222",
    name: "BANGDA (Mackerel)",
    teluguName: "బంగ్డా (కనగుర్తులు)",
    description: "Indian Mackerel (Bangda). Rich in omega-3, flavorful spicy roast favorite.",
    imageUrl: `${FISH_CDN_BASE}/bangda.webp`,
    categoryName: "Sea Fish / Marine",
    unitPrice: 350,
    unitBasis: "Net 1000g · Gross 1200g",
    pricing: { basePrice: 350, effectivePrice: 350, hasDiscount: false, discount: null },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 4:00 AM Harbor",
    waterSource: "West Coast Deep Sea Catch",
  },
  {
    id: "88888888-8888-4888-a888-888888888888",
    name: "VANJARAM (King Fish)",
    teluguName: "వంజరం (సీర్ ఫిష్)",
    description: "King Seer Fish (Vanjaram). Top grade tawa roast center cut steaks.",
    imageUrl: `${FISH_CDN_BASE}/vanjaram.webp`,
    categoryName: "Sea Fish / Marine",
    unitPrice: 800,
    unitBasis: "Net 1000g · Gross 1150g",
    pricing: { basePrice: 800, effectivePrice: 800, hasDiscount: false, discount: null },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 4:30 AM Harbor",
    waterSource: "Arabian Sea Line Catch",
  },
  {
    id: "99999999-9999-4999-a999-999999999999",
    name: "WHITE POMFRET",
    teluguName: "తెల్ల చందువా",
    description: "Exquisite White Pomfret. Whole diamond cut, pan fry coastal delicacy.",
    imageUrl: `${FISH_CDN_BASE}/white-pomfret.webp`,
    categoryName: "Sea Fish / Marine",
    unitPrice: 1500,
    unitBasis: "Net 1000g · Gross 1100g",
    pricing: { basePrice: 1500, effectivePrice: 1500, hasDiscount: false, discount: null },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 4:00 AM Harbor",
    waterSource: "Mangalore Coast Deep Sea",
  },
  {
    id: "77777777-7777-4777-a777-777777777777",
    name: "TUNA STEAKS",
    teluguName: "ట్యూనా (సూర చేప)",
    description: "Deep-sea fresh Tuna. Dense, meaty steaks sliced across the bone.",
    imageUrl: `${FISH_CDN_BASE}/tuna.webp`,
    categoryName: "Sea Fish / Marine",
    unitPrice: 450,
    unitBasis: "Net 1000g · Gross 1200g",
    pricing: { basePrice: 450, effectivePrice: 450, hasDiscount: false, discount: null },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 4:15 AM Harbor",
    waterSource: "Deep Pelagic Marine Catch",
  },
  {
    id: "33333333-3333-4333-a333-333333333333",
    name: "BLUE CRABS",
    teluguName: "పీతలు",
    description: "Fresh coastal blue swimming crabs. Sweet delicate meat.",
    imageUrl: `${FISH_CDN_BASE}/blue-crabs.webp`,
    categoryName: "Shellfish & Prawns",
    unitPrice: 700,
    unitBasis: "Net 1000g · Gross 1300g",
    pricing: { basePrice: 700, effectivePrice: 700, hasDiscount: false, discount: null },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 5:00 AM Harbor",
    waterSource: "Coastal Brackish Lagoon",
  },
  {
    id: "55555555-5555-4555-a555-555555555555",
    name: "TIGER PRAWNS",
    teluguName: "రొయ్యలు (టైగర్)",
    description: "Premium jumbo Tiger Prawns. Giant succulent crustaceans.",
    imageUrl: `${FISH_CDN_BASE}/tiger-prawns.webp`,
    categoryName: "Shellfish & Prawns",
    unitPrice: 999,
    unitBasis: "Net 1000g · Gross 1250g",
    originalPrice: 1250,
    discountPercent: 20,
    stockLeft: "Only 2 kg left",
    pricing: {
      basePrice: 1250,
      effectivePrice: 999,
      hasDiscount: true,
      discount: { type: 'PERCENTAGE', value: 20, savings: 251 },
    },
    physicalAvailable: true,
    onlineBookable: true,
    freshnessTier: "0-24H FRESH",
    catchDate: "Today 5:15 AM Harbor",
    waterSource: "Estuarine Saltwater Farm",
  },
];

const QUICK_PILLS = [
  { id: 'All Catch', label: 'All Catch' },
  { id: 'Boneless', label: 'Boneless' },
  { id: 'Freshwater', label: 'Freshwater' },
  { id: 'Prawns & Crabs', label: 'Prawns & Crabs' },
  { id: 'Fry & Steaks', label: 'Fry & Steaks' },
];

const CATEGORY_GROUPS = [
  {
    id: 'freshwater',
    title: 'Freshwater Catches',
    subtitle: 'Harvested fresh every morning from inland ponds',
    categoryName: 'Freshwater Fish',
  },
  {
    id: 'marine',
    title: 'Sea Fish & Marine',
    subtitle: 'Direct from morning coastal harbor reefer transit',
    categoryName: 'Sea Fish / Marine',
  },
  {
    id: 'shellfish',
    title: 'Crabs & Shellfish',
    subtitle: 'Live coastal swimming crabs and jumbo prawns',
    categoryName: 'Shellfish & Prawns',
  },
];

export default function HomeScreen({
  routeParams = {},
  onNavigate,
  cartCount = 0,
}) {
  const [fishList, setFishList] = useState(DEV_MOCK_FISH);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuickPill, setActiveQuickPill] = useState('All Catch');
  const [cartQuantities, setCartQuantities] = useState({});
  const [addingFishId, setAddingFishId] = useState(null);

  // User subscription state (e.g. ₹1,500 active pass or 0)
  const [userBalance, setUserBalance] = useState(1500);

  // Filter bottom sheet modal state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterAvailability, setFilterAvailability] = useState('ALL');
  const [filterSort, setFilterSort] = useState('DEFAULT');

  // Load backend fish list or fallback to DEV_MOCK_FISH
  const loadData = useCallback(async () => {
    try {
      const res = await api.getFish();
      if (res && res.data && res.data.length > 0) {
        setFishList(res.data);
      } else {
        setFishList(DEV_MOCK_FISH);
      }
    } catch (err) {
      setFishList(DEV_MOCK_FISH);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Pack & Quantity selection bottom sheet modal (Licious/FreshToHome standard)
  const [packModalVisible, setPackModalVisible] = useState(false);
  const [packModalFish, setPackModalFish] = useState(null);
  const [emptyCartModalVisible, setEmptyCartModalVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const [selectedWeightMode, setSelectedWeightMode] = useState('1');
  const [customWeightInput, setCustomWeightInput] = useState('');

  // Cart actions
  const handleAddToCart = useCallback((item) => {
    setPackModalFish(item);
    setSelectedWeightMode('1');
    setCustomWeightInput('');
    setPackModalVisible(true);
  }, []);

  const handleConfirmPackAdd = useCallback((weightKg) => {
    if (!packModalFish || !weightKg || weightKg <= 0) return;
    const itemId = packModalFish.fishId || packModalFish.id;
    setAddingFishId(itemId);
    setCartQuantities((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
    if (api && api.addToCart) {
      api.addToCart({
        fishId: itemId,
        quantity: weightKg,
      }).catch(() => {});
    }
    setPackModalVisible(false);
    setTimeout(() => setAddingFishId(null), 300);
  }, [packModalFish]);

  const handleIncrement = useCallback((item) => {
    const itemId = item.fishId || item.id;
    setCartQuantities((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  }, []);

  const handleDecrement = useCallback((item) => {
    const itemId = item.fishId || item.id;
    setCartQuantities((prev) => {
      const current = prev[itemId] || 0;
      if (current <= 1) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }
      return { ...prev, [itemId]: current - 1 };
    });
  }, []);

  const handleNavigateDetails = useCallback((item) => {
    if (onNavigate) {
      const fishObj = DEV_MOCK_FISH.find((f) => f.id === (item.fishId || item.id)) || item;
      const target = {
        ...fishObj,
        ...item,
        id: fishObj.id || item.fishId || item.id,
        pricing: item.pricing || fishObj.pricing,
        unitPrice: item.unitPrice || fishObj.unitPrice,
      };
      onNavigate('FISH_DETAILS', { fishId: target.id, fish: target });
    }
  }, [onNavigate]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCategory !== 'ALL') count++;
    if (filterAvailability !== 'ALL') count++;
    if (filterSort !== 'DEFAULT') count++;
    return count;
  }, [filterCategory, filterAvailability, filterSort]);

  // Filter and sort fish list
  const filteredFishList = useMemo(() => {
    let result = [...fishList];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.teluguName && f.teluguName.includes(q)) ||
          (f.description && f.description.toLowerCase().includes(q)) ||
          (f.categoryName && f.categoryName.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (filterCategory !== 'ALL') {
      result = result.filter((f) => f.categoryName === filterCategory);
    }

    // Availability filter
    if (filterAvailability === 'ONLINE') {
      result = result.filter((f) => f.onlineBookable !== false);
    } else if (filterAvailability === 'STORE') {
      result = result.filter((f) => f.physicalAvailable !== false);
    }

    // Sort
    if (filterSort === 'PRICE_LOW') {
      result.sort((a, b) => a.unitPrice - b.unitPrice);
    } else if (filterSort === 'PRICE_HIGH') {
      result.sort((a, b) => b.unitPrice - a.unitPrice);
    }

    return result;
  }, [fishList, searchQuery, filterCategory, filterAvailability, filterSort]);

  // Total cart calculation
  const totalCartItems = useMemo(() => {
    return Object.values(cartQuantities).reduce((sum, qty) => sum + qty, 0);
  }, [cartQuantities]);

  const totalCartAmount = useMemo(() => {
    return Object.entries(cartQuantities).reduce((sum, [id, qty]) => {
      const fish = fishList.find((f) => f.id === id);
      const effectivePrice = fish?.pricing?.effectivePrice || fish?.unitPrice || 0;
      return sum + (effectivePrice * qty);
    }, 0);
  }, [cartQuantities, fishList]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E56A0" />

      {/* 1. SEAMLESS BLUE GRADIENT HEADER WRAPPER (180deg: #164682 -> #1E5A9E -> #D8E8F8 -> #F5F7FA) */}
      <View style={styles.gradientHeaderWrapper}>
        <Image
          source={require('../assets/home_gradient.png')}
          style={StyleSheet.absoluteFillObject}
          resizeMode="stretch"
        />

        {/* Top Header Row (Transparent child) */}
        <View style={styles.headerTransparent}>
          {/* Logo & Location */}
          <View style={styles.brandRow}>
            <View style={styles.headerLogoCard}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.headerLogoImage}
                resizeMode="contain"
              />
            </View>
            <TouchableOpacity style={styles.locationPill} activeOpacity={0.8}>
              <LocationPinIcon size={12} color="#FFFFFF" />
              <Text style={styles.locationPillText} numberOfLines={1}>
                Indiranagar ▾
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right Actions: Balance / Save 20% + Profile */}
          <View style={styles.headerRightActions}>
            {userBalance > 0 ? (
              <TouchableOpacity
                style={styles.balancePill}
                onPress={() => onNavigate && onNavigate('SUBSCRIPTION')}
                activeOpacity={0.85}
                accessibilityLabel={`Balance ₹${userBalance}`}
              >
                <Text style={styles.balancePillText}>₹{userBalance}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.savePill}
                onPress={() => onNavigate && onNavigate('SUBSCRIPTION')}
                activeOpacity={0.85}
                accessibilityLabel="Save 20% with Pond Pass"
              >
                <Text style={styles.savePillText}>Save 20%</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => onNavigate && onNavigate('PROFILE')}
              activeOpacity={0.85}
              accessibilityLabel="View Profile"
            >
              <Text style={styles.profileBtnText}>P</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar Row (Transparent child) */}
        <View style={styles.searchWrapperTransparent}>
          <View style={styles.searchBox}>
            <SearchIcon size={18} color="#1E56A0" />
            <TextInput
              style={styles.searchInput}
              placeholder='Search "fresh pomfret, rohu, prawns"...'
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              returnKeyType="search"
              autoCorrect={false}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* MAIN SCROLLABLE DASHBOARD */}
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1E56A0"
            colors={['#1E56A0']}
          />
        }
      >
        {/* 3. TODAY'S FLASH DEALS: HORIZONTAL SCROLL OF VERTICAL OFFER CARDS */}
        <View style={styles.offersSection}>
          <View style={styles.offersSectionHeader}>
            <Text style={styles.offersSectionTitle}>Today's Special Offers</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.offersScrollList}
          >
            {HIGHLIGHTED_OFFERS.map((offer) => {
              const qty = cartQuantities[offer.fishId] || 0;
              return (
                <View key={offer.id} style={styles.offerCardVertical}>
                  {/* Flush Top-Left Flashy Discount Badge */}
                  <View style={styles.offerDiscountBadge}>
                    <Text style={styles.offerDiscountBadgeText}>
                      <Text style={styles.offerDiscountBadgePercent}>{offer.discountPercent}%</Text> OFF
                    </Text>
                  </View>

                  {/* Fish Photo Canvas */}
                  <TouchableOpacity
                    onPress={() => handleNavigateDetails(offer)}
                    style={styles.offerImageBox}
                    activeOpacity={0.9}
                  >
                    <OptimizedFishImage
                      uri={offer.imageUrl}
                      style={styles.offerFishImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>

                  {/* Title & Regional Telugu Name */}
                  <TouchableOpacity
                    onPress={() => handleNavigateDetails(offer)}
                    activeOpacity={0.85}
                    style={styles.offerTitleBox}
                  >
                    <Text style={styles.offerFishName} numberOfLines={1}>{offer.name}</Text>
                    <Text style={styles.offerFishTelugu} numberOfLines={1}>{offer.teluguName}</Text>
                  </TouchableOpacity>

                  {/* Stock Left Urgency Badge (Only X kg left) */}
                  <View style={styles.offerStockBadge}>
                    <Text style={styles.offerStockBadgeText}>{offer.stockLeft || 'Only 4 kg left'}</Text>
                  </View>

                  {/* Pricing & Add to Cart / Stepper */}
                  <View style={styles.offerActionRow}>
                    <View style={styles.offerPriceBlock}>
                      {/* Top: Strikethrough & Big Green Savings Tag */}
                      <View style={styles.offerStrikeRow}>
                        <View style={styles.offerStrikeBox}>
                          <Text style={styles.offerStrikeText}>₹{offer.originalPrice}</Text>
                          <View style={styles.offerRedLine} />
                        </View>
                        <View style={styles.offerSavePill}>
                          <Text style={styles.offerSavePillText}>Save ₹{offer.savings}</Text>
                        </View>
                      </View>

                      {/* Bottom: Final Effective Price */}
                      <View style={styles.offerPriceLine}>
                        <Text style={styles.offerPriceVal}>₹{offer.unitPrice}</Text>
                        <Text style={styles.offerPriceUnit}>/KG</Text>
                      </View>
                    </View>

                    {/* Stepper or Button */}
                    {qty > 0 ? (
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          onPress={() => handleDecrement(offer)}
                          style={styles.stepperBtn}
                        >
                          <MinusIcon size={12} color="#0F2C59" />
                        </TouchableOpacity>
                        <View style={styles.stepperQtyBox}>
                          <Text style={styles.stepperQtyText}>{qty}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleIncrement(offer)}
                          style={styles.stepperBtn}
                        >
                          <PlusIcon size={12} color="#0F2C59" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.offerAddBtn}
                        onPress={() => handleAddToCart(offer)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.offerAddBtnText}>+ ADD</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* 4. COMPACT CATALOGUE HEADER WITH PROFESSIONAL FILTER (NO GEAR EMOJI) */}
        <View style={styles.catalogueHeaderBar}>
          <View>
            <Text style={styles.catalogueHeaderTitle}>
              Daily Fresh Harvest ({filteredFishList.length})
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.filterToggleBtn,
              activeFilterCount > 0 && styles.filterToggleBtnActive,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.filterToggleBtnText,
                activeFilterCount > 0 && styles.filterToggleBtnTextActive,
              ]}
            >
              Filter
            </Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadgeCircle}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 5. 2-COLUMN GROUPED FISH CATALOGUE (NO EMOJIS, NO HEART ICONS) */}
        {CATEGORY_GROUPS.map((group) => {
          const groupFishes = filteredFishList.filter(
            (f) => f.categoryName === group.categoryName
          );

          if (groupFishes.length === 0) return null;

          return (
            <View key={group.id} style={styles.categorySection}>
              {/* Category Group Heading */}
              <View style={styles.groupHeadingBox}>
                <Text style={styles.groupTitle}>{group.title}</Text>
              </View>

              {/* 2-Column Grid */}
              <View style={styles.gridContainer}>
                {groupFishes.map((item) => (
                  <View key={item.id} style={styles.gridCardWrapper}>
                    <FishCard
                      item={item}
                      isAdding={addingFishId === item.id}
                      cartQuantity={cartQuantities[item.id] || 0}
                      quantityInCart={cartQuantities[item.id] || 0}
                      onAddToCart={handleAddToCart}
                      onPress={handleNavigateDetails}
                      onIncrement={handleIncrement}
                      onDecrement={handleDecrement}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {filteredFishList.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Catches Match Your Filter</Text>
            <Text style={styles.emptySubtitle}>
              Try resetting your category or search filters to see all available catches.
            </Text>
            <TouchableOpacity
              style={styles.emptyResetBtn}
              onPress={() => {
                setSearchQuery('');
                setFilterCategory('ALL');
                setFilterAvailability('ALL');
                setFilterSort('DEFAULT');
              }}
            >
              <Text style={styles.emptyResetBtnText}>Reset All Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 6. SLIDE-UP FILTER BOTTOM SHEET MODAL */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Filter & Sort Catches</Text>
              <TouchableOpacity
                onPress={() => {
                  setFilterCategory('ALL');
                  setFilterAvailability('ALL');
                  setFilterSort('DEFAULT');
                }}
              >
                <Text style={styles.modalResetText}>Reset All</Text>
              </TouchableOpacity>
            </View>

            {/* Category Filter */}
            <Text style={styles.filterSectionTitle}>Catch Type</Text>
            <View style={styles.filterChipRow}>
              {[
                { label: 'All Fish', val: 'ALL' },
                { label: 'Freshwater', val: 'Freshwater Fish' },
                { label: 'Sea Fish / Marine', val: 'Sea Fish / Marine' },
                { label: 'Crabs & Shellfish', val: 'Shellfish & Prawns' },
              ].map((chip) => (
                <TouchableOpacity
                  key={chip.val}
                  style={[
                    styles.filterChip,
                    filterCategory === chip.val && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterCategory(chip.val)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterCategory === chip.val && styles.filterChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Availability Filter */}
            <Text style={styles.filterSectionTitle}>Availability</Text>
            <View style={styles.filterChipRow}>
              {[
                { label: 'All Catches', val: 'ALL' },
                { label: 'Online Bookable', val: 'ONLINE' },
                { label: 'In-Store Counter', val: 'STORE' },
              ].map((chip) => (
                <TouchableOpacity
                  key={chip.val}
                  style={[
                    styles.filterChip,
                    filterAvailability === chip.val && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterAvailability(chip.val)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterAvailability === chip.val && styles.filterChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sort Filter */}
            <Text style={styles.filterSectionTitle}>Sort By</Text>
            <View style={styles.filterChipRow}>
              {[
                { label: 'Default', val: 'DEFAULT' },
                { label: 'Price: Low to High', val: 'PRICE_LOW' },
                { label: 'Price: High to Low', val: 'PRICE_HIGH' },
              ].map((chip) => (
                <TouchableOpacity
                  key={chip.val}
                  style={[
                    styles.filterChip,
                    filterSort === chip.val && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterSort(chip.val)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterSort === chip.val && styles.filterChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              style={styles.modalApplyBtn}
              onPress={() => setFilterModalVisible(false)}
            >
              <Text style={styles.modalApplyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 7. PERSISTENT STICKY CART BAR */}
      {totalCartItems > 0 && (
        <View style={styles.stickyCartBar}>
          <View style={styles.stickyCartInfo}>
            <View style={styles.stickyCartIconBox}>
              <CartIcon size={18} color="#FFFFFF" />
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
            onPress={() => onNavigate && onNavigate('CART')}
            activeOpacity={0.88}
          >
            <Text style={styles.stickyCartCtaText}>View Basket →</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* 8. QUANTITY & PACK SELECTOR BOTTOM SHEET */}
      <Modal
        visible={packModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPackModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPackModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.packModalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            {packModalFish && (() => {
              const effectivePrice = packModalFish.pricing?.effectivePrice || packModalFish.unitPrice || 0;
              const originalRate = packModalFish.originalPrice || Math.round(effectivePrice * 1.25);

              const weightPresets = [
                { id: '1', weight: 1, label: '1 kg', serves: 'Serves 3-4', isPopular: true },
                { id: '1.5', weight: 1.5, label: '1.5 kg', serves: 'Serves 5-6' },
                { id: '2', weight: 2, label: '2 kg', serves: 'Family Pack' },
                { id: 'custom', weight: null, label: 'Custom', serves: 'Enter kg' },
              ];

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

              const totalPrice = Math.round(effectivePrice * activeWeightKg);
              const isValidWeight = activeWeightKg > 0;
              const ctaText = isValidWeight
                ? `Add to Cart (${activeWeightKg} kg) • ₹${totalPrice}`
                : (selectedWeightMode === 'custom' && !customWeightInput ? 'Enter Weight in kg' : 'Invalid Weight');

              return (
                <View>
                  {/* Top Row: Larger rounded thumbnail, Title, Telugu & Circular Close Button */}
                  <View style={styles.packHeaderRow}>
                    <OptimizedFishImage
                      uri={packModalFish.imageUrl}
                      style={styles.packThumbImage}
                      resizeMode="contain"
                    />
                    <View style={styles.packHeaderText}>
                      <Text style={styles.packFishName} numberOfLines={1}>
                        {packModalFish.name}
                      </Text>
                      {Boolean(packModalFish.teluguName) && (
                        <Text style={styles.packFishTelugu}>{packModalFish.teluguName}</Text>
                      )}
                      <Text style={styles.packBaseRate}>
                        ₹{effectivePrice} / 1 kg net
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setPackModalVisible(false)}
                      style={styles.modalCloseBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.modalCloseBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.packSectionLabel}>SELECT WEIGHT</Text>

                  {/* 4 Clean Selectable Options in 2x2 Grid */}
                  <View style={styles.weightGrid}>
                    {weightPresets.map((opt) => {
                      const isSelected = selectedWeightMode === opt.id;
                      const optPrice = opt.weight ? Math.round(effectivePrice * opt.weight) : null;
                      const optOrigPrice = opt.weight ? Math.round(originalRate * opt.weight) : null;

                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.weightCard,
                            isSelected && styles.weightCardActive,
                          ]}
                          onPress={() => setSelectedWeightMode(opt.id)}
                          activeOpacity={0.8}
                        >
                          {opt.isPopular && (
                            <View style={styles.popularBadge}>
                              <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                            </View>
                          )}
                          <Text style={[styles.weightCardLabel, isSelected && styles.weightCardLabelActive]}>
                            {opt.label}
                          </Text>
                          <Text style={styles.weightCardServes}>{opt.serves}</Text>
                          <View style={styles.weightPriceRow}>
                            {optPrice !== null ? (
                              <>
                                <Text style={[styles.weightCardPrice, isSelected && styles.weightCardPriceActive]}>
                                  ₹{optPrice}
                                </Text>
                                {optOrigPrice > optPrice && (
                                  <Text style={styles.weightCardOriginalPrice}>
                                    ₹{optOrigPrice}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <Text style={[styles.weightCardPrice, isSelected && styles.weightCardPriceActive]}>
                                ₹{effectivePrice}/kg
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Clean Numeric Input Field when Custom is Selected */}
                  {selectedWeightMode === 'custom' && (
                    <View style={styles.customWeightContainer}>
                      <Text style={styles.customWeightPrompt}>Custom Weight in kg:</Text>
                      <View style={styles.customInputWrapper}>
                        <TextInput
                          style={styles.customWeightInput}
                          placeholder="e.g. 0.5, 1.25, 2.5"
                          placeholderTextColor="#94A3B8"
                          keyboardType="decimal-pad"
                          value={customWeightInput}
                          onChangeText={setCustomWeightInput}
                          autoFocus={true}
                        />
                        <View style={styles.kgSuffixBadge}>
                          <Text style={styles.kgSuffixText}>kg</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Full-Width Primary CTA Button (quantity stepper removed) */}
                  <TouchableOpacity
                    style={[
                      styles.fullWidthAddCta,
                      !isValidWeight && styles.fullWidthAddCtaDisabled,
                    ]}
                    onPress={() => handleConfirmPackAdd(activeWeightKg)}
                    disabled={!isValidWeight}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.fullWidthAddCtaText}>
                      {ctaText}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 9. FLOATING CART FAB (Hidden on keyboard/search focus, never overlaps +ADD) */}
      {!isKeyboardVisible && !isSearchFocused && (
        <TouchableOpacity
          style={styles.floatingCartFab}
          onPress={() => {
            if (totalCartItems > 0) {
              if (onNavigate) onNavigate('CART');
            } else {
              setEmptyCartModalVisible(true);
            }
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Open Cart"
        >
          <CartIcon size={24} color="#FFFFFF" />
          {totalCartItems > 0 && (
            <View style={styles.floatingCartBadge}>
              <Text style={styles.floatingCartBadgeText}>{totalCartItems}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* 10. EMPTY CART BOTTOM SHEET MODAL */}
      <Modal
        visible={emptyCartModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmptyCartModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setEmptyCartModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.emptyCartSheet}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <View style={styles.emptyCartIconCircle}>
              <CartIcon size={38} color="#1E56A0" />
            </View>

            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <Text style={styles.emptyCartSubtitle}>
              Add fresh catch to get started!
            </Text>

            <TouchableOpacity
              style={styles.browseFishBtn}
              onPress={() => setEmptyCartModalVisible(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.browseFishBtnText}>Browse Fish</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#1E56A0',
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoImage: {
    width: 66,
    height: 32,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
  locationPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balancePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  balancePillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E56A0',
  },
  savePill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 8,
  },
  savePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  profileBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  profileBtnText: {
    color: '#1E56A0',
    fontWeight: '800',
    fontSize: 13,
  },
  searchWrapper: {
    backgroundColor: '#1E56A0',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#16437E',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#0F2C59',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#94A3B8',
    paddingHorizontal: 4,
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 115,
  },
  
  gradientHeaderWrapper: {
    position: 'relative',
    backgroundColor: '#164682',
    overflow: 'hidden',
  },
  headerTransparent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 6,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  searchWrapperTransparent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    backgroundColor: 'transparent',
  },
  pillsOuter: {
    paddingTop: 4,
    paddingBottom: 14,
  },
  quickPillsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  quickPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#164682',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  quickPillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickPillTextActive: {
    color: '#164682',
    fontWeight: '800',
  },
  quickPillTextInactive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  urgencyPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyPillText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  offersSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  offersSectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  offersSectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: -0.3,
  },
  offersSectionSub: {
    fontSize: 11.5,
    color: '#425B73',
    marginTop: 1,
    fontWeight: '500',
  },
  offersScrollList: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  offerCardVertical: {
    width: 182,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.8,
    borderColor: '#F59E0B',
    padding: 10,
    paddingTop: 14,
    marginHorizontal: 4,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  offerDiscountBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#D90429',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopLeftRadius: 14,
    borderBottomRightRadius: 14,
    zIndex: 10,
    shadowColor: '#D90429',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  offerDiscountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  offerDiscountBadgePercent: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  offerImageBox: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  offerFishImage: {
    width: '100%',
    height: '100%',
  },
  offerFreshPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#1E56A0',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  offerFreshPillText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  offerTitleBox: {
    minHeight: 36,
    justifyContent: 'center',
  },
  offerFishName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F2C59',
    lineHeight: 16,
    letterSpacing: -0.2,
  },
  offerFishTelugu: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  offerStockBadge: {
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    marginBottom: 6,
  },
  offerStockBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#B45309',
  },
  offerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  offerPriceBlock: {
    flexDirection: 'column',
  },
  offerStrikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  offerStrikeBox: {
    position: 'relative',
    marginRight: 5,
  },
  offerStrikeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  offerRedLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: '#DC2626',
  },
  offerSavePill: {
    backgroundColor: '#E6F8F0',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  offerSavePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D824D',
  },
  offerPriceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  offerPriceVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F2C59',
    letterSpacing: -0.3,
  },
  offerPriceUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  offerAddBtn: {
    backgroundColor: '#0F2C59',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerAddBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 28,
  },
  stepperBtn: {
    paddingHorizontal: 6,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyBox: {
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F2C59',
  },
  catalogueHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
  },
  catalogueHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: -0.35,
  },
  catalogueHeaderSub: {
    fontSize: 11.5,
    color: '#425B73',
    marginTop: 2,
    fontWeight: '500',
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterToggleBtnActive: {
    borderColor: '#1E56A0',
    backgroundColor: '#EFF6FF',
  },
  filterToggleBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F2C59',
  },
  filterToggleBtnTextActive: {
    color: '#1E56A0',
  },
  filterBadgeCircle: {
    backgroundColor: '#1E56A0',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  categorySection: {
    marginTop: 10,
    paddingHorizontal: 12,
  },
  groupHeadingBox: {
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: -0.3,
  },
  groupSubtitle: {
    fontSize: 11,
    color: '#425B73',
    marginTop: 1,
    fontWeight: '500',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCardWrapper: {
    width: '50%',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1C33',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyResetBtn: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyResetBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 28, 51, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0A1C33',
  },
  modalResetText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  filterChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0A1C33',
    borderColor: '#0A1C33',
  },
  filterChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalApplyBtn: {
    backgroundColor: '#0A1C33',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  modalApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stickyCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A1C33',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  stickyCartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyCartIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stickyCartTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stickyCartSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  stickyCartCta: {
    backgroundColor: '#009B70',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stickyCartCtaText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  // Floating Cart Button
  
  weightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 14,
  },
  weightCard: {
    width: '48%',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    alignItems: 'flex-start',
  },
  weightCardActive: {
    borderColor: '#1B4E8C',
    backgroundColor: '#EFF6FF',
    shadowColor: '#1B4E8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  weightCardLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
    marginTop: 2,
  },
  weightCardLabelActive: {
    color: '#1B4E8C',
  },
  weightCardServes: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  weightPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  weightCardPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  weightCardPriceActive: {
    color: '#1B4E8C',
  },
  weightCardOriginalPrice: {
    fontSize: 11.5,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  customWeightContainer: {
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  customWeightPrompt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  customInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1B4E8C',
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
  kgSuffixBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#DBEAFE',
  },
  kgSuffixText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B4E8C',
  },
  fullWidthAddCta: {
    width: '100%',
    backgroundColor: '#1E56A0',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E56A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  fullWidthAddCtaDisabled: {
    backgroundColor: '#94A3B8',
    elevation: 0,
    shadowOpacity: 0,
  },
  fullWidthAddCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  floatingCartFab: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E56A0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E56A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 40,
  },
  floatingCartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#DC2626',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  floatingCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  // Pack & Quantity Selector Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  packModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 16,
  },
  packHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  packThumbImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginRight: 14,
  },
  packHeaderText: {
    flex: 1,
  },
  packFishName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F2C59',
  },
  packFishTelugu: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  packBaseRate: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E56A0',
    marginTop: 3,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  packSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  packOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  packCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    position: 'relative',
  },
  packCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1B4E8C',
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -9,
    backgroundColor: '#1B4E8C',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    elevation: 2,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  packCardLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F2C59',
    marginBottom: 2,
    textAlign: 'center',
  },
  packCardLabelActive: {
    color: '#1B4E8C',
  },
  packCardServes: {
    fontSize: 9.5,
    color: '#64748B',
    marginBottom: 6,
  },
  packPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  packCardPrice: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F2C59',
  },
  packCardPriceActive: {
    color: '#1B4E8C',
  },
  packCardOriginalPrice: {
    fontSize: 10.5,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  packBottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  packStepperCombined: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 48,
    paddingHorizontal: 4,
  },
  packStepperBtnCombined: {
    width: 38,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packStepperQtyCombined: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2C59',
    minWidth: 24,
    textAlign: 'center',
  },
  packAddCtaCombined: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#1E56A0',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E56A0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  packAddCtaTextCombined: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  // Empty Cart Bottom Sheet
  emptyCartSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'android' ? 28 : 36,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 16,
  },
  emptyCartIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F2C59',
    marginBottom: 6,
  },
  emptyCartSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    marginBottom: 22,
    textAlign: 'center',
  },
  browseFishBtn: {
    width: '100%',
    backgroundColor: '#1E56A0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E56A0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  browseFishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
