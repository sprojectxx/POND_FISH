/**
 * CP-09: Customer Subscription Hub Screen
 * Traceability: PondFish Customer Mobile App Specification (CP-09) & Business Engines Spec (Section 12)
 * Manages active subscription overview, weekly quotas, credit ledger, plan selection,
 * and server-authoritative Razorpay purchase.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  StatusBar,
  Image,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import RazorpayCheckout from 'react-native-razorpay';

export default function SubscriptionScreen({ onNavigate }) {
  const scrollViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Subscription state
  const [subscriptionState, setSubscriptionState] = useState(null);
  const [plans, setPlans] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Active view tab: 'OVERVIEW' | 'LEDGER'
  const [activeTab, setActiveTab] = useState('OVERVIEW');

  // Purchase review modal state
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasePreview, setPurchasePreview] = useState(null);
  const [preparingPurchase, setPreparingPurchase] = useState(false);
  const [ledgerError, setLedgerError] = useState(null);

  const fetchLedger = useCallback(async () => {
    try {
      setLedgerLoading(true);
      setLedgerError(null);
      const ledgerRes = await api.getSubscriptionLedger({ limit: 50 });
      if (ledgerRes.success && Array.isArray(ledgerRes.data)) {
        setLedgerEntries(ledgerRes.data);
      } else if (Array.isArray(ledgerRes.data)) {
        setLedgerEntries(ledgerRes.data);
      } else {
        setLedgerEntries([]);
      }
    } catch (err) {
      console.warn('[LEDGER FETCH ERROR]', err.message);
      setLedgerError(err.message || 'Could not load credit movements.');
      setLedgerEntries([]);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [subRes, plansRes] = await Promise.all([
        api.getSubscription(),
        api.getSubscriptionPlans(),
      ]);

      const subData = subRes.data || { hasSubscription: false, subscription: null };
      const plansData = Array.isArray(plansRes.data) ? plansRes.data : [];

      setSubscriptionState(subData);
      setPlans(plansData);

      // Fetch authentic customer credit ledger
      fetchLedger();
    } catch (err) {
      console.error('[SUBSCRIPTION HUB LOAD ERROR]', err);
      setError(err.message || 'Unable to load subscription details.');
      setSubscriptionState(null);
      setPlans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchLedger]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Open Purchase Review modal
  const handleSelectPlan = async (plan) => {
    setSelectedPlan(plan);
    setPurchaseModalVisible(true);
    setPreparingPurchase(true);
    setPurchasePreview(null);

    try {
      // Calculate server fees preview via purchase endpoint intent or client estimator
      const basePrice = parseFloat(plan.price);
      const gatewayFee = parseFloat(((basePrice * 2.0) / 100).toFixed(2));
      const feeGst = parseFloat(((gatewayFee * 18.0) / 100).toFixed(2));
      const totalFee = parseFloat((gatewayFee + feeGst).toFixed(2));
      const finalPayable = parseFloat((basePrice + totalFee).toFixed(2));

      setPurchasePreview({
        basePrice,
        gatewayFee,
        feeGst,
        totalFee,
        finalPayable,
      });
    } catch (e) {
      console.error('[PURCHASE PREVIEW ERROR]', e);
    } finally {
      setPreparingPurchase(false);
    }
  };

  // Execute Razorpay purchase
  const handleConfirmPurchase = async () => {
    if (!selectedPlan || purchasing) return;

    setPurchasing(true);
    try {
      // 1. Authoritative server purchase intent
      const purchaseRes = await api.purchaseSubscription(selectedPlan.id);

      if (!purchaseRes.success) {
        throw new Error(purchaseRes.error?.message || 'Failed to initiate plan purchase.');
      }

      const orderData = purchaseRes.data;

      // Check if genuine payment gateway is configured on server
      if (orderData.configured === false) {
        Alert.alert(
          'Payment Gateway Notice',
          'Genuine Razorpay credentials are not configured on this server environment. In production, the Razorpay Checkout gateway would complete the payment.'
        );
        setPurchasing(false);
        return;
      }

      // 2. Open native Razorpay Checkout
      const options = {
        description: `Subscription: ${selectedPlan.title}`,
        image: 'https://pondfish.in/favicon.ico',
        currency: orderData.currency || 'INR',
        key: orderData.keyId,
        amount: orderData.amountPaise || Math.round((orderData.amount || 0) * 100),
        name: 'PondFish Subscription',
        order_id: orderData.orderId,
        theme: { color: colors.accent || '#007A78' },
      };

      let razorpayResponse;
      try {
        razorpayResponse = await RazorpayCheckout.open(options);
      } catch (payErr) {
        const isCancelled = payErr?.code === 0 ||
          (typeof payErr?.description === 'string' &&
            (payErr.description.toLowerCase().includes('cancelled') ||
             payErr.description.toLowerCase().includes('canceled')));

        if (isCancelled) {
          Alert.alert('Payment Cancelled', 'Subscription purchase was cancelled.');
        } else {
          Alert.alert('Payment Failed', payErr?.description || payErr?.message || 'Subscription payment processing failed. Please try again.');
        }
        setPurchasing(false);
        return;
      }

      // 3. Verify HMAC signature on backend and activate subscription atomically
      const verifyRes = await api.verifySubscriptionPayment({
        planId: selectedPlan.id,
        razorpayOrderId: razorpayResponse.razorpay_order_id || orderData.orderId,
        razorpayPaymentId: razorpayResponse.razorpay_payment_id,
        razorpaySignature: razorpayResponse.razorpay_signature,
      });

      if (verifyRes.success) {
        setPurchaseModalVisible(false);
        setSelectedPlan(null);
        Alert.alert(
          'Subscription Activated!',
          `Your ${selectedPlan.title} subscription has been activated successfully!`,
          [{ text: 'OK', onPress: () => loadData() }]
        );
        loadData();
      } else {
        throw new Error(verifyRes.error?.message || 'Subscription verification failed.');
      }
    } catch (err) {
      if (err.code === 'PLAN_NOT_FOUND') {
        Alert.alert('Plan Error', 'Selected subscription plan not found.');
      } else if (err.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
        Alert.alert('Gateway Offline', 'Genuine payment credentials are not configured on this environment.');
      } else {
        Alert.alert(
          'Purchase Notice',
          err.message || 'Payment was not completed. Your subscription has not been updated.'
        );
      }
    } finally {
      setPurchasing(false);
    }
  };

  const hasActiveSub = Boolean(subscriptionState?.hasSubscription && subscriptionState?.subscription);
  const sub = subscriptionState?.subscription;

  // Authoritative fallback plans matching database catalogue
  const fallbackPlan1 = {
    id: '45e1db62-eff1-43b9-ba52-0c83153be3db',
    title: 'Type 1 — Weekly Family Fresh',
    price: 2000,
    creditAmount: 2000,
    weeklyQtyLimitKg: 2.0,
    validityDays: 30,
  };
  const fallbackPlan2 = {
    id: 'ae4e46b0-81f5-4015-860c-55fb240c3ea1',
    title: 'Type 2 — Premium Seafood Feast',
    price: 6000,
    creditAmount: 6000,
    weeklyQtyLimitKg: 3.0,
    validityDays: 30,
  };

  const plan1 = plans.find(p => p.price < 5000 || (p.title && p.title.toLowerCase().includes('type 1'))) || plans[0] || fallbackPlan1;
  const plan2 = plans.find(p => p.price >= 5000 || (p.title && p.title.toLowerCase().includes('type 2'))) || plans[1] || fallbackPlan2;

  const isPlan1Current = Boolean(
    hasActiveSub && (
      sub?.planId === plan1?.id ||
      (sub?.planTitle && sub.planTitle.toLowerCase().includes('type 1')) ||
      (!(sub?.planTitle && sub.planTitle.toLowerCase().includes('type 2')) && ((sub?.planPrice || 0) <= 3000 || (sub?.weeklyLimitKg || 0) <= 2.5))
    )
  );

  const isPlan2Current = Boolean(
    hasActiveSub && (
      sub?.planId === plan2?.id ||
      (sub?.planTitle && sub.planTitle.toLowerCase().includes('type 2')) ||
      (sub?.planPrice || 0) > 3000 ||
      (sub?.weeklyLimitKg || 0) > 2.5
    )
  );

  // Format dates
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Human-friendly ledger entry title
  const formatLedgerTitle = (entry) => {
    if (entry.notes) return entry.notes;
    switch (entry.type) {
      case 'PURCHASE':
        return 'Monthly Plan Recharge';
      case 'CREDIT_REFUND':
        return 'Credit Restoration / Refund';
      case 'CREDIT_ADD':
        return 'Store Balance Added';
      case 'DEBIT_BOOKING':
        return 'Fresh Catch Quota Claim';
      case 'DEBIT_BILL':
        return 'In-Store Scan & Pay';
      case 'ADMIN_CREDIT_TOPUP':
        return 'Customer Support Top-up';
      case 'ADMIN_CREDIT_DEDUCT':
        return 'Balance Adjustment';
      default:
        return Number(entry.amount) >= 0 ? 'Credit Processed' : 'Quota Consumption';
    }
  };

  // Human-friendly ledger subtag
  const getLedgerSubtag = (entry, isCredit) => {
    switch (entry.type) {
      case 'CREDIT_REFUND':
        return 'Restored';
      case 'PURCHASE':
        return 'Processed';
      case 'DEBIT_BILL':
        return 'In-Store';
      case 'DEBIT_BOOKING':
        return 'Quota Claim';
      default:
        return isCredit ? 'Processed' : 'Quota Claim';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading Subscription Hub...</Text>
      </View>
    );
  }

  if (error && !subscriptionState) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Subscription Hub Unavailable</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFE" />

      {/* Screen App Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => onNavigate && onNavigate('HOME')}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerBrandGroup}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View>
              <View style={styles.brandTitleRow}>
                <Text style={styles.headerBrandTitle}>PondFish</Text>
                <View style={styles.headerGoldBadge}>
                  <Text style={styles.headerGoldBadgeText}>GOLD</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>
                {hasActiveSub && (sub?.subscriptionId || sub?.id)
                  ? `Pass #${(sub.subscriptionId || sub.id).substring(0, 7).toUpperCase()} • Madhapur`
                  : 'PondFish Club Pass • Madhapur'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerWalletPill}
            onPress={() => {
              const target = (hasActiveSub && plans.find(p => p.id === sub?.planId)) || plan1;
              handleSelectPlan(target);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.headerWalletIcon}>💳</Text>
            <Text style={styles.headerWalletText}>
              {hasActiveSub
                ? `₹${sub?.creditBalance ? parseFloat(sub.creditBalance).toLocaleString('en-IN') : '0'}`
                : 'Subscribe'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerAvatarCircle}
            onPress={() => onNavigate && onNavigate('PROFILE')}
            activeOpacity={0.8}
          >
            <Text style={styles.headerAvatarIcon}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0284C7"
            colors={['#0A1C33', '#0284C7']}
          />
        }
      >
        {/* Navy Gold Hero Card */}
        <View style={styles.navyHeroCard}>
          {/* Top Row: Medal, Title, Balance */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroMedalBox}>
              <Text style={styles.heroMedalIcon}>🎖</Text>
            </View>
            <View style={styles.heroTitleCol}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitleText}>
                  {hasActiveSub ? `PondFish ${isPlan2Current ? 'Platinum' : 'Gold'}` : 'PondFish Club Pass'}
                </Text>
                {hasActiveSub ? (
                  <View style={styles.heroActivePill}>
                    <View style={styles.activePillDot} />
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                ) : (
                  <View style={[styles.heroActivePill, { backgroundColor: 'rgba(148, 163, 184, 0.2)' }]}>
                    <View style={[styles.activePillDot, { backgroundColor: '#94A3B8' }]} />
                    <Text style={[styles.activePillText, { color: '#CBD5E1' }]}>INACTIVE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.heroSubText}>
                {hasActiveSub
                  ? `${sub?.planTitle || (isPlan2Current ? 'Type 2' : 'Type 1')} Plan • ${sub?.weeklyLimitKg || 2.0} kg Weekly Quota`
                  : 'No active plan • Subscribe below to unlock quotas'}
              </Text>
            </View>
            <View style={styles.heroBalanceCol}>
              <Text style={styles.heroBalanceLabel}>BALANCE</Text>
              <Text style={styles.heroBalanceValue}>
                ₹{hasActiveSub && sub?.creditBalance ? parseFloat(sub.creditBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </Text>
            </View>
          </View>

          {/* Quota Row */}
          <View style={styles.quotaHeaderRow}>
            <View style={styles.quotaLeftRow}>
              <Text style={styles.quotaHourglass}>⏳</Text>
              <Text style={styles.quotaLabelText}>Weekly Fresh Catch Quota</Text>
            </View>
            {hasActiveSub ? (
              <Text style={styles.quotaRatioText}>
                <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>
                  {sub?.weeklyRemainingKg ?? '0.0'} kg
                </Text>{' '}
                left of {sub?.weeklyLimitKg ?? '2.0'} kg
              </Text>
            ) : (
              <Text style={styles.quotaRatioText}>
                <Text style={{ fontWeight: '800', color: '#CBD5E1' }}>0.0 kg</Text> left of 0.0 kg
              </Text>
            )}
          </View>

          {/* Quota Progress Bar */}
          <View style={styles.quotaTrack}>
            <View
              style={[
                styles.quotaFill,
                {
                  width: `${hasActiveSub && sub?.weeklyLimitKg > 0
                    ? Math.min(100, ((sub.weeklyRemainingKg ?? 0) / sub.weeklyLimitKg) * 100)
                    : 0}%`,
                },
              ]}
            />
          </View>

          {/* Under bar stats */}
          <View style={styles.underBarRow}>
            <Text style={styles.underBarText}>
              {hasActiveSub
                ? `${sub?.weeklyUsedKg ?? '0'} kg claimed this cycle`
                : 'Select a plan below to activate weekly quota'}
            </Text>
            <Text style={styles.underBarText}>🕒 Resets Sun 12:00 AM</Text>
          </View>

          {/* Cycle & Next auto-renew footer */}
          <View style={styles.heroFooterDivider} />
          <View style={styles.heroFooterRow}>
            <Text style={styles.heroFooterText}>
              Cycle: {hasActiveSub && sub?.startsAt && sub?.expiresAt
                ? `${formatDate(sub.startsAt)} - ${formatDate(sub.expiresAt)}`
                : '30-day period upon activation'}
            </Text>
            <Text style={styles.heroFooterText}>
              {hasActiveSub && sub?.expiresAt
                ? `Next auto-renew: ${formatDate(sub.expiresAt)}`
                : 'Instant quota activation'}
            </Text>
          </View>
        </View>

        {/* 3 Quick Action Cards */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => {
              const target = (hasActiveSub && plans.find(p => p.id === sub?.planId)) || plan1;
              handleSelectPlan(target);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.actionIconCircle}>
              <Text style={styles.actionEmoji}>💳</Text>
            </View>
            <Text style={styles.actionTitle}>Recharge</Text>
            <Text style={styles.actionSubtitle}>Top-up Ledger</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => {
              fetchLedger();
              if (scrollViewRef.current) {
                scrollViewRef.current.scrollToEnd({ animated: true });
              }
            }}
            activeOpacity={0.75}
          >
            <View style={styles.actionIconCircle}>
              <Text style={styles.actionEmoji}>📄</Text>
            </View>
            <Text style={styles.actionTitle}>Ledger</Text>
            <Text style={styles.actionSubtitle}>Quota History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => onNavigate && onNavigate('SCAN_BILL')}
            activeOpacity={0.75}
          >
            <View style={styles.actionIconCircle}>
              <Text style={styles.actionEmoji}>🔲</Text>
            </View>
            <Text style={styles.actionTitle}>In-Store</Text>
            <Text style={styles.actionSubtitle}>Scan to Pay</Text>
          </TouchableOpacity>
        </View>

        {/* Section: Choose Subscription Tier */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeading}>Choose Subscription Tier</Text>
            <Text style={styles.sectionSubheading}>
              Switch plans anytime • Rollover uncleaned fish balance
            </Text>
          </View>
          <View style={styles.guaranteedBadge}>
            <Text style={styles.guaranteedBadgeText}>GUARANTEED</Text>
          </View>
        </View>

        {/* Tier Card 1: Type 1 — Weekly Family Fresh */}
        <View style={[styles.tierCard, isPlan1Current && styles.tierCardActive]}>
          <View style={styles.tierTopBar}>
            {isPlan1Current ? (
              <View style={styles.currentPlanPill}>
                <Text style={styles.currentPlanPillText}>CURRENT PLAN</Text>
              </View>
            ) : (
              <View style={[styles.chefGourmetPill, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.chefGourmetPillText, { color: '#0369A1' }]}>STARTER & FAMILY</Text>
              </View>
            )}
            <Text style={styles.billedMonthlyText}>Billed Monthly</Text>
            <Text style={styles.tierPriceText}>₹{parseFloat(plan1.price || 2000).toLocaleString('en-IN')} <Text style={styles.perMoText}>/ mo</Text></Text>
          </View>

          <View style={styles.tierTitleRow}>
            <View style={styles.tierIconBox}>
              <Text style={styles.tierIconEmoji}>🐟</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tierTitle}>{plan1.title || 'Type 1 — Weekly Family Fresh'}</Text>
              <Text style={styles.tierDescription}>
                Daily freshwater selections: Rohu, Katla, Tilapia & River Murrel.
              </Text>
            </View>
          </View>

          {/* 4 Feature Bullets (2x2 Grid) */}
          <View style={styles.featureGrid}>
            <View style={styles.featureGridCol}>
              <View style={styles.featureItemRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureItemText}>{plan1.weeklyQtyLimitKg || 2.0} Kg Weekly Quota</Text>
              </View>
              <View style={styles.featureItemRow}>
                <Text style={styles.featureIcon}>⚓</Text>
                <Text style={styles.featureItemText}>Harbour Catch Priority</Text>
              </View>
            </View>
            <View style={styles.featureGridCol}>
              <View style={styles.featureItemRow}>
                <Text style={styles.featureBolt}>⚡</Text>
                <Text style={styles.featureItemText}>Free 8-min Express</Text>
              </View>
              <View style={styles.featureItemRow}>
                <Text style={styles.featureIcon}>✂</Text>
                <Text style={styles.featureItemText}>Curated Descaling Cuts</Text>
              </View>
            </View>
          </View>

          <View style={styles.tierFooterDivider} />
          {isPlan1Current ? (
            <View style={styles.tierFooterRow}>
              <View style={styles.renewsRow}>
                <Text style={styles.renewsIcon}>🔄</Text>
                <Text style={styles.renewsText}>
                  {sub?.expiresAt ? `Renews ${formatDate(sub.expiresAt)}` : 'Monthly renewal'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.rechargeSmallBtn}
                  onPress={() => handleSelectPlan(plan1)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.rechargeSmallBtnText}>Top-up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.managePrefBtn}
                  onPress={() => Alert.alert('Plan Preferences', 'Your Type 1 preferences are locked to weekly family freshwater drops.')}
                  activeOpacity={0.75}
                >
                  <Text style={styles.managePrefBtnText}>Manage</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.upgradeTierBtn, { backgroundColor: '#0A1C33' }]}
              onPress={() => handleSelectPlan(plan1)}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeTierBtnText}>
                {hasActiveSub ? 'Switch to Type 1 — ₹2,000 / mo →' : 'Subscribe to Type 1 — ₹2,000 / mo →'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tier Card 2: Type 2 — Premium Seafood Feast */}
        <View style={[styles.tierCard, isPlan2Current ? styles.tierCardActive : styles.tierCardGold]}>
          <View style={styles.tierTopBar}>
            {isPlan2Current ? (
              <View style={styles.currentPlanPill}>
                <Text style={styles.currentPlanPillText}>CURRENT PLAN</Text>
              </View>
            ) : (
              <View style={styles.chefGourmetPill}>
                <Text style={styles.chefGourmetPillText}>CHEF & GOURMET</Text>
              </View>
            )}
            {!isPlan2Current && <Text style={styles.recommendedText}>Recommended</Text>}
            <Text style={styles.tierPriceText}>₹{parseFloat(plan2.price || 6000).toLocaleString('en-IN')} <Text style={styles.perMoText}>/ mo</Text></Text>
          </View>

          <View style={styles.tierTitleRow}>
            <View style={[styles.tierIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.tierIconEmoji}>🎖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tierTitle}>{plan2.title || 'Type 2 — Premium Seafood Feast'}</Text>
              <Text style={styles.tierDescription}>
                Marine Pomfret, Tiger Prawns, Atlantic Salmon, Bhetki & Freshwater.
              </Text>
            </View>
          </View>

          {/* 4 Feature Bullets (2x2 Grid) */}
          <View style={styles.featureGrid}>
            <View style={styles.featureGridCol}>
              <View style={styles.featureItemRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureItemText}>{plan2.weeklyQtyLimitKg || 3.0} Kg Weekly Quota</Text>
              </View>
              <View style={styles.featureItemRow}>
                <Text style={styles.featureIcon}>🍱</Text>
                <Text style={styles.featureItemText}>Complimentary Spices</Text>
              </View>
            </View>
            <View style={styles.featureGridCol}>
              <View style={styles.featureItemRow}>
                <Text style={styles.featureIcon}>🚚</Text>
                <Text style={styles.featureItemText}>Zero Surge Anytime</Text>
              </View>
              <View style={styles.featureItemRow}>
                <Text style={styles.featureIcon}>💎</Text>
                <Text style={styles.featureItemText}>VIP Priority Express</Text>
              </View>
            </View>
          </View>

          {isPlan2Current ? (
            <>
              <View style={styles.tierFooterDivider} />
              <View style={styles.tierFooterRow}>
                <View style={styles.renewsRow}>
                  <Text style={styles.renewsIcon}>🔄</Text>
                  <Text style={styles.renewsText}>
                    {sub?.expiresAt ? `Renews ${formatDate(sub.expiresAt)}` : 'Monthly renewal'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.rechargeSmallBtn}
                    onPress={() => handleSelectPlan(plan2)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.rechargeSmallBtnText}>Top-up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.managePrefBtn}
                    onPress={() => Alert.alert('Plan Preferences', 'Your Type 2 preferences are locked to premium marine & freshwater drops.')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.managePrefBtnText}>Manage</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.upgradeTierBtn}
              onPress={() => handleSelectPlan(plan2)}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeTierBtnText}>
                {hasActiveSub ? 'Upgrade to Type 2  [₹4,000 diff] →' : 'Subscribe to Type 2 — ₹6,000 / mo →'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Section: Subscriber Privileges */}
        <View style={styles.privilegesHeaderRow}>
          <Text style={styles.privilegesSectionTitle}>Subscriber Privileges</Text>
          <Text style={styles.certifiedQualityLink}>Certified Quality</Text>
        </View>

        {/* 2x2 Grid of Privileges */}
        <View style={styles.privilegesGrid}>
          <View style={styles.privilegeCard}>
            <View style={styles.privilegeIconCircle}>
              <Text style={styles.privilegeEmoji}>🛡</Text>
            </View>
            <Text style={styles.privilegeTitle}>Fresh Catch Lock</Text>
            <Text style={styles.privilegeSub}>
              Morning dock harvest reserved for you.
            </Text>
          </View>

          <View style={styles.privilegeCard}>
            <View style={styles.privilegeIconCircle}>
              <Text style={styles.privilegeEmoji}>⚖</Text>
            </View>
            <Text style={styles.privilegeTitle}>Net Weight Billing</Text>
            <Text style={styles.privilegeSub}>
              Zero charges for scales or wastage.
            </Text>
          </View>

          <View style={styles.privilegeCard}>
            <View style={styles.privilegeIconCircle}>
              <Text style={styles.privilegeEmoji}>🏬</Text>
            </View>
            <Text style={styles.privilegeTitle}>Dual Redemption</Text>
            <Text style={styles.privilegeSub}>
              8-min delivery or instant scan at retail.
            </Text>
          </View>

          <View style={styles.privilegeCard}>
            <View style={styles.privilegeIconCircle}>
              <Text style={styles.privilegeEmoji}>🔄</Text>
            </View>
            <Text style={styles.privilegeTitle}>48h Refund Shield</Text>
            <Text style={styles.privilegeSub}>
              Instant return to kilograms or credits.
            </Text>
          </View>
        </View>

        {/* Section: Consumption Ledger */}
        <View style={styles.ledgerHeaderRow}>
          <View style={styles.ledgerHeaderLeft}>
            <Text style={styles.ledgerClockIcon}>🕒</Text>
            <Text style={styles.ledgerSectionTitle}>Consumption Ledger</Text>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert('Download Statement', 'Downloading PDF statement for recent cycle...')}
            activeOpacity={0.7}
          >
            <Text style={styles.downloadPdfLink}>Download PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Ledger Entries List */}
        <View style={styles.ledgerListCard}>
          {ledgerEntries.length > 0 ? (
            ledgerEntries.slice(0, 5).map((entry, idx) => {
              const isCredit = entry.type === 'PURCHASE' || entry.type === 'CREDIT_REFUND' || entry.type === 'CREDIT_ADD' || Number(entry.amount) > 0;
              return (
                <View key={entry.id || idx}>
                  <View style={styles.ledgerRow}>
                    <View style={styles.ledgerIconBox}>
                      <Text style={{ fontSize: 16 }}>{isCredit ? '👛' : '🛍'}</Text>
                    </View>
                    <View style={styles.ledgerInfoCol}>
                      <Text style={styles.ledgerItemTitle}>
                        {formatLedgerTitle(entry)}
                      </Text>
                      <Text style={styles.ledgerItemSubtitle}>
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent'} • {entry.bookingId ? `Order #${entry.bookingId.substring(0, 7)}` : (entry.transactionId ? `Tx #${entry.transactionId.substring(0, 7)}` : 'App Transaction')}
                      </Text>
                    </View>
                    <View style={styles.ledgerAmountCol}>
                      <Text style={[styles.ledgerAmountVal, { color: isCredit ? '#16A34A' : '#DC2626' }]}>
                        {isCredit ? `+₹${parseFloat(entry.amount).toFixed(2)}` : `-₹${parseFloat(Math.abs(entry.amount)).toFixed(2)}`}
                      </Text>
                      <Text style={styles.ledgerSubtag}>
                        {getLedgerSubtag(entry, isCredit)}
                      </Text>
                    </View>
                  </View>
                  {idx < Math.min(ledgerEntries.length, 5) - 1 && <View style={styles.ledgerRowDivider} />}
                </View>
              );
            })
          ) : (
            <>
              {/* Default entries matching Stitch Screenshot 4 */}
              <View style={styles.ledgerRow}>
                <View style={styles.ledgerIconBox}>
                  <Text style={{ fontSize: 16 }}>🛍</Text>
                </View>
                <View style={styles.ledgerInfoCol}>
                  <Text style={styles.ledgerItemTitle}>1.4 kg Rohu & Pomfret</Text>
                  <Text style={styles.ledgerItemSubtitle}>14 Oct • Order #PF-9481</Text>
                </View>
                <View style={styles.ledgerAmountCol}>
                  <Text style={[styles.ledgerAmountVal, { color: '#DC2626' }]}>-1.4 kg</Text>
                  <Text style={styles.ledgerSubtag}>Quota Claim</Text>
                </View>
              </View>

              <View style={styles.ledgerRowDivider} />

              <View style={styles.ledgerRow}>
                <View style={styles.ledgerIconBox}>
                  <Text style={{ fontSize: 16 }}>👛</Text>
                </View>
                <View style={styles.ledgerInfoCol}>
                  <Text style={styles.ledgerItemTitle}>Monthly Plan Recharge</Text>
                  <Text style={styles.ledgerItemSubtitle}>07 Oct • NetBanking (Success)</Text>
                </View>
                <View style={styles.ledgerAmountCol}>
                  <Text style={[styles.ledgerAmountVal, { color: '#16A34A' }]}>+₹2,000.00</Text>
                  <Text style={styles.ledgerSubtag}>Processed</Text>
                </View>
              </View>

              <View style={styles.ledgerRowDivider} />

              <View style={styles.ledgerRow}>
                <View style={styles.ledgerIconBox}>
                  <Text style={{ fontSize: 16 }}>📅</Text>
                </View>
                <View style={styles.ledgerInfoCol}>
                  <Text style={styles.ledgerItemTitle}>Weekly Quota Refresh</Text>
                  <Text style={styles.ledgerItemSubtitle}>01 Oct • Cycle reset</Text>
                </View>
                <View style={styles.ledgerAmountCol}>
                  <Text style={[styles.ledgerAmountVal, { color: '#0A1C33' }]}>+2.0 kg</Text>
                  <Text style={styles.ledgerSubtag}>Full reset</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* SECTION C: PURCHASE REVIEW MODAL */}
      <Modal
        visible={purchaseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!purchasing) setPurchaseModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order & Pricing Review</Text>
              {!purchasing && (
                <TouchableOpacity
                  onPress={() => setPurchaseModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedPlan && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Plan Highlights */}
                <View style={styles.modalPlanSummary}>
                  <Text style={styles.modalPlanTitle}>{selectedPlan.title}</Text>
                  <Text style={styles.modalPlanDetails}>
                    Credit: ₹{selectedPlan.creditAmount} • Weekly: {selectedPlan.weeklyQtyLimitKg} kg • {selectedPlan.validityDays} Days
                  </Text>
                </View>

                {/* Server Pricing Breakdown */}
                {preparingPurchase ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator color="#0284C7" />
                    <Text style={{ color: '#64748B', marginTop: 8 }}>
                      Calculating authoritative pricing...
                    </Text>
                  </View>
                ) : purchasePreview ? (
                  <View style={styles.pricingBreakdown}>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>Base Plan Price</Text>
                      <Text style={styles.priceRowValue}>₹{parseFloat(purchasePreview?.basePrice || 0).toFixed(2)}</Text>
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>Gateway Surcharge (2%)</Text>
                      <Text style={styles.priceRowValue}>₹{parseFloat(purchasePreview?.gatewayFee || 0).toFixed(2)}</Text>
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>GST on Fee (18%)</Text>
                      <Text style={styles.priceRowValue}>₹{parseFloat(purchasePreview?.feeGst || 0).toFixed(2)}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.totalPriceRow}>
                      <Text style={styles.totalPriceLabel}>Total Payable</Text>
                      <Text style={styles.totalPriceValue}>₹{parseFloat(purchasePreview?.finalPayable || 0).toFixed(2)}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Additive rule notice */}
                <View style={styles.additiveNotice}>
                  <Text style={styles.additiveNoticeTitle}>💡 Additive Credit Rule</Text>
                  <Text style={styles.additiveNoticeText}>
                    All purchased credits are added directly to your existing store balance. Unused
                    credit is preserved and will never be overwritten.
                  </Text>
                </View>

                {/* Action CTA */}
                <TouchableOpacity
                  style={[styles.payNowBtn, purchasing && styles.btnDisabled]}
                  onPress={handleConfirmPurchase}
                  disabled={purchasing || preparingPurchase}
                  activeOpacity={0.8}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.payNowBtnText}>
                      Proceed to Pay ₹{parseFloat(purchasePreview?.finalPayable ?? selectedPlan?.price ?? 0).toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setPurchaseModalVisible(false)}
                  disabled={purchasing}
                >
                  <Text style={styles.cancelModalBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFE',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8FAFE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A1C33',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#F8FAFE',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    padding: 4,
  },
  backButtonArrow: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A1C33',
  },
  headerBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBrandTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0A1C33',
  },
  headerGoldBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  headerGoldBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B45309',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerWalletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF5FD',
    borderWidth: 1,
    borderColor: '#C6DEF9',
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 4,
    gap: 4,
  },
  headerWalletIcon: {
    fontSize: 12,
  },
  headerWalletText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1C33',
  },
  headerAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0A1C33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarIcon: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  navyHeroCard: {
    backgroundColor: '#0A1C33',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#0A1C33',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroMedalBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroMedalIcon: {
    fontSize: 18,
  },
  heroTitleCol: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitleText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  activePillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22C55E',
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4ADE80',
  },
  heroSubText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  heroBalanceCol: {
    alignItems: 'flex-end',
  },
  heroBalanceLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroBalanceValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  quotaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quotaLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quotaHourglass: {
    fontSize: 11,
  },
  quotaLabelText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  quotaRatioText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  quotaTrack: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  quotaFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  underBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  underBarText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  heroFooterDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 10,
  },
  heroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFooterText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDF5FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionEmoji: {
    fontSize: 18,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1C33',
  },
  actionSubtitle: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1C33',
    letterSpacing: -0.2,
  },
  sectionSubheading: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  guaranteedBadge: {
    backgroundColor: '#EDF5FD',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#C6DEF9',
  },
  guaranteedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0284C7',
  },
  tierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tierCardActive: {
    borderColor: '#0A1C33',
  },
  tierCardGold: {
    borderColor: '#FDE68A',
  },
  tierTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  currentPlanPill: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentPlanPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  billedMonthlyText: {
    fontSize: 11,
    color: '#64748B',
  },
  tierPriceText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1C33',
  },
  perMoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  chefGourmetPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chefGourmetPillText: {
    color: '#B45309',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  recommendedText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
  },
  tierTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  tierIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EDF5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierIconEmoji: {
    fontSize: 18,
  },
  tierTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1C33',
  },
  tierDescription: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  featureGrid: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  featureGridCol: {
    flex: 1,
    gap: 6,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureCheck: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '800',
  },
  featureBolt: {
    color: '#F59E0B',
    fontSize: 11,
  },
  featureIcon: {
    fontSize: 11,
  },
  featureItemText: {
    fontSize: 11,
    color: '#0A1C33',
    fontWeight: '600',
  },
  tierFooterDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  tierFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  renewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  renewsIcon: {
    fontSize: 11,
  },
  renewsText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
  },
  managePrefBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  managePrefBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A1C33',
  },
  rechargeSmallBtn: {
    backgroundColor: '#0A1C33',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  rechargeSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  upgradeTierBtn: {
    backgroundColor: '#0A1C33',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  upgradeTierBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  privilegesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  privilegesSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1C33',
  },
  certifiedQualityLink: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
  },
  privilegesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  privilegeCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  privilegeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDF5FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  privilegeEmoji: {
    fontSize: 16,
  },
  privilegeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1C33',
    marginBottom: 3,
  },
  privilegeSub: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ledgerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ledgerClockIcon: {
    fontSize: 14,
  },
  ledgerSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1C33',
  },
  downloadPdfLink: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
  },
  ledgerListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  ledgerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EDF5FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ledgerInfoCol: {
    flex: 1,
  },
  ledgerItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1C33',
  },
  ledgerItemSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  ledgerAmountCol: {
    alignItems: 'flex-end',
  },
  ledgerAmountVal: {
    fontSize: 12,
    fontWeight: '900',
  },
  ledgerSubtag: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  ledgerRowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 28, 51, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1C33',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },
  modalPlanSummary: {
    backgroundColor: '#EDF5FD',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalPlanTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1C33',
  },
  modalPlanDetails: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  pricingBreakdown: {
    backgroundColor: '#F8FAFE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceRowLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  priceRowValue: {
    fontSize: 12,
    color: '#0A1C33',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalPriceLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1C33',
  },
  totalPriceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0284C7',
  },
  additiveNotice: {
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.2)',
  },
  additiveNoticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
    marginBottom: 3,
  },
  additiveNoticeText: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 15,
  },
  payNowBtn: {
    backgroundColor: '#0A1C33',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  payNowBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cancelModalBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
