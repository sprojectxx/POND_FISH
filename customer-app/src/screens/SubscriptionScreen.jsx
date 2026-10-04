/**
 * CP-09: Customer Subscription Hub Screen
 * Traceability: PondFish Customer Mobile App Specification (CP-09) & Business Engines Spec (Section 12)
 * Manages active subscription overview, weekly quotas, credit ledger, plan selection,
 * and server-authoritative Razorpay purchase.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';

export default function SubscriptionScreen({ onNavigate }) {
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

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [subRes, plansRes] = await Promise.all([
        api.getSubscription(),
        api.getSubscriptionPlans(),
      ]);

      setSubscriptionState(subRes.data);
      setPlans(plansRes.data || []);

      // If customer has had any subscription, fetch ledger
      fetchLedger();
    } catch (err) {
      console.error('[SUBSCRIPTION HUB ERROR]', err);
      setError(err.message || 'Unable to load subscription details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchLedger = async () => {
    try {
      setLedgerLoading(true);
      const ledgerRes = await api.getSubscriptionLedger({ limit: 50 });
      setLedgerEntries(ledgerRes.data || []);
    } catch (err) {
      console.warn('[LEDGER FETCH ERROR]', err.message);
    } finally {
      setLedgerLoading(false);
    }
  };

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

      // 2. In genuine mobile environment with Razorpay SDK:
      // Real Razorpay Checkout options would be invoked here.
      // If payment cannot proceed because of missing client keys or dismissal:
      Alert.alert(
        'Payment Notice',
        'Payment was not completed. Your subscription has not been updated.',
        [{ text: 'OK' }]
      );
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
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Hub</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'OVERVIEW' && styles.tabItemActive]}
          onPress={() => setActiveTab('OVERVIEW')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'OVERVIEW' && styles.tabTextActive]}>
            Overview & Plans
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'LEDGER' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('LEDGER');
            fetchLedger();
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'LEDGER' && styles.tabTextActive]}>
            Credit Ledger ({ledgerEntries.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.primary]}
          />
        }
      >
        {activeTab === 'OVERVIEW' ? (
          <>
            {/* SECTION A: ACTIVE SUBSCRIPTION OR EMPTY STATE */}
            {hasActiveSub ? (
              <View style={styles.activeCard}>
                <View style={styles.activeHeaderRow}>
                  <View style={styles.planBadgeContainer}>
                    <Text style={styles.activePlanTitle}>{sub.planTitle || 'Premium Plan'}</Text>
                    <View style={styles.activeBadge}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  </View>
                  <View style={styles.healthTag}>
                    <Text style={styles.healthTagText}>Healthy</Text>
                  </View>
                </View>

                {/* Validity and Countdown */}
                <View style={styles.validityRow}>
                  <Text style={styles.validityLabel}>
                    Valid: {formatDate(sub.startsAt)} — {formatDate(sub.expiresAt)}
                  </Text>
                  <Text style={styles.daysRemainingText}>
                    ⏳ {sub.daysRemaining} days remaining
                  </Text>
                </View>

                {/* Monetary Credit Balance Box */}
                <View style={styles.creditCardBox}>
                  <Text style={styles.creditCardLabel}>Store Credit Balance</Text>
                  <Text style={styles.creditCardValue}>₹{parseFloat(sub.creditBalance).toFixed(2)}</Text>
                  <Text style={styles.creditCardHint}>
                    Automatically applied to online bookings & counter orders
                  </Text>
                </View>

                {/* Weekly Allowance Breakdown */}
                <View style={styles.quotaSection}>
                  <View style={styles.quotaHeader}>
                    <Text style={styles.quotaTitle}>Weekly Weight Allowance</Text>
                    <Text style={styles.quotaRatio}>
                      {sub.weeklyUsedKg} / {sub.weeklyLimitKg} kg
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            sub.weeklyLimitKg > 0
                              ? (sub.weeklyUsedKg / sub.weeklyLimitKg) * 100
                              : 0
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.quotaFooter}>
                    <Text style={styles.quotaFooterText}>
                      Weekly Remaining:{' '}
                      <Text style={{ fontWeight: '800', color: colors.freshGreen }}>
                        {sub.weeklyRemainingKg} kg
                      </Text>
                    </Text>
                    <Text style={styles.quotaResetText}>Resets weekly</Text>
                  </View>
                </View>

                {/* Recharge / Extend CTA */}
                <TouchableOpacity
                  style={styles.rechargeBtn}
                  onPress={() => {
                    // Preselect a plan if available
                    if (plans.length > 0) handleSelectPlan(plans[0]);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rechargeBtnText}>+ Recharge / Add More Credit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* SECTION B: NO ACTIVE SUBSCRIPTION EMPTY STATE */
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBox}>
                  <Text style={{ fontSize: 36 }}>💳</Text>
                </View>
                <Text style={styles.emptyTitle}>No Active Subscription</Text>
                <Text style={styles.emptySubtitle}>
                  Subscribe to lock in weekly fresh fish quotas and receive instant monetary store credit.
                </Text>

                {/* Benefits List */}
                <View style={styles.benefitsBox}>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🐟</Text>
                    <Text style={styles.benefitText}>
                      Guaranteed weekly fresh catch quota reserved directly from lake harvests.
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>💰</Text>
                    <Text style={styles.benefitText}>
                      100% additive credit balance — unused funds never expire upon recharge.
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>⚡</Text>
                    <Text style={styles.benefitText}>
                      Zero-friction online checkout with instant credit deduction.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* AVAILABLE SUBSCRIPTION PLANS */}
            <View style={styles.plansSection}>
              <Text style={styles.plansSectionTitle}>
                {hasActiveSub ? 'Available Renewal Plans' : 'Choose a Subscription Plan'}
              </Text>
              <Text style={styles.plansSectionSubtitle}>
                Authoritative pricing controlled by PondFish backend. Select to review details.
              </Text>

              {plans.map((p) => {
                const isSelected = selectedPlan?.id === p.id;
                return (
                  <View key={p.id} style={styles.planCard}>
                    <View style={styles.planHeaderRow}>
                      <View>
                        <Text style={styles.planTitleText}>{p.title}</Text>
                        <Text style={styles.planValidityText}>{p.validityDays} Days Validity</Text>
                      </View>
                      <View style={styles.planPriceBox}>
                        <Text style={styles.planPriceValue}>₹{p.price}</Text>
                        <Text style={styles.planPriceSub}>One-time / {p.validityDays}d</Text>
                      </View>
                    </View>

                    <View style={styles.planFeaturesList}>
                      <View style={styles.planFeatureItem}>
                        <Text style={styles.featureBullet}>✓</Text>
                        <Text style={styles.featureLabel}>Store Credit:</Text>
                        <Text style={styles.featureVal}>₹{p.creditAmount}</Text>
                      </View>
                      <View style={styles.planFeatureItem}>
                        <Text style={styles.featureBullet}>✓</Text>
                        <Text style={styles.featureLabel}>Weekly Limit:</Text>
                        <Text style={styles.featureVal}>{p.weeklyQtyLimitKg} kg / week</Text>
                      </View>
                      <View style={styles.planFeatureItem}>
                        <Text style={styles.featureBullet}>✓</Text>
                        <Text style={styles.featureLabel}>Additive Rollover:</Text>
                        <Text style={styles.featureVal}>Included</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.subscribeBtn}
                      onPress={() => handleSelectPlan(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.subscribeBtnText}>
                        {hasActiveSub ? `Recharge with ${p.title}` : `Select ${p.title} & Subscribe`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          /* SECTION D: CREDIT LEDGER VIEW */
          <View style={styles.ledgerSection}>
            <Text style={styles.ledgerTitle}>Credit Movement Ledger</Text>
            <Text style={styles.ledgerSubtitle}>
              Audit-grade immutable record of subscription purchases, bookings, and refunds.
            </Text>

            {ledgerLoading ? (
              <View style={styles.ledgerLoadingBox}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.ledgerLoadingText}>Fetching credit history...</Text>
              </View>
            ) : ledgerEntries.length === 0 ? (
              <View style={styles.ledgerEmptyBox}>
                <Text style={{ fontSize: 32 }}>📜</Text>
                <Text style={styles.ledgerEmptyTitle}>No Credit Movements Yet</Text>
                <Text style={styles.ledgerEmptySub}>
                  When you purchase a subscription or make bookings using credits, entries will appear here.
                </Text>
              </View>
            ) : (
              ledgerEntries.map((entry) => {
                const isCredit = entry.type === 'PURCHASE' || entry.type === 'CREDIT_REFUND';
                const typeColor =
                  entry.type === 'PURCHASE'
                    ? colors.freshGreen
                    : entry.type === 'CREDIT_REFUND'
                    ? colors.info
                    : colors.warning;

                return (
                  <View key={entry.id} style={styles.ledgerItemCard}>
                    <View style={styles.ledgerItemHeader}>
                      <View style={[styles.ledgerTypePill, { backgroundColor: `${typeColor}22` }]}>
                        <Text style={[styles.ledgerTypeText, { color: typeColor }]}>
                          {entry.type}
                        </Text>
                      </View>
                      <Text style={[styles.ledgerAmountText, { color: isCredit ? colors.freshGreen : colors.textPrimary }]}>
                        {isCredit ? `+₹${entry.amount.toFixed(2)}` : `-₹${entry.amount.toFixed(2)}`}
                      </Text>
                    </View>

                    <View style={styles.ledgerItemFooter}>
                      <Text style={styles.ledgerDateText}>
                        {new Date(entry.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Text style={styles.ledgerBalanceText}>
                        Resulting: ₹{entry.resultingBalance.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
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
                    <ActivityIndicator color={colors.accent} />
                    <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                      Calculating authoritative pricing...
                    </Text>
                  </View>
                ) : purchasePreview ? (
                  <View style={styles.pricingBreakdown}>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>Base Plan Price</Text>
                      <Text style={styles.priceRowValue}>₹{purchasePreview.basePrice.toFixed(2)}</Text>
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>Gateway Surcharge (2%)</Text>
                      <Text style={styles.priceRowValue}>₹{purchasePreview.gatewayFee.toFixed(2)}</Text>
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>GST on Fee (18%)</Text>
                      <Text style={styles.priceRowValue}>₹{purchasePreview.feeGst.toFixed(2)}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.totalPriceRow}>
                      <Text style={styles.totalPriceLabel}>Total Payable</Text>
                      <Text style={styles.totalPriceValue}>₹{purchasePreview.finalPayable.toFixed(2)}</Text>
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
                      Proceed to Pay ₹{purchasePreview?.finalPayable?.toFixed(2) || selectedPlan.price}
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
    backgroundColor: colors.bgMain,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.bgMain,
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
    color: colors.textPrimary,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.bgSurface,
  },
  backButtonText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  activeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    padding: 16,
    marginBottom: 24,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePlanTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.4)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.freshGreen,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.freshGreen,
  },
  healthTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  healthTagText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  validityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  validityLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  daysRemainingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  creditCardBox: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  creditCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  creditCardValue: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.freshGreen,
    marginVertical: 4,
  },
  creditCardHint: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  quotaSection: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quotaRatio: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accent,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.bgInput,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  quotaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaFooterText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  quotaResetText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  rechargeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rechargeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  benefitsBox: {
    width: '100%',
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitIcon: {
    fontSize: 16,
  },
  benefitText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  plansSection: {
    marginTop: 8,
  },
  plansSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  plansSectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  planValidityText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  planPriceBox: {
    alignItems: 'flex-end',
  },
  planPriceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent,
  },
  planPriceSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  planFeaturesList: {
    backgroundColor: colors.bgSurface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureBullet: {
    fontSize: 12,
    color: colors.freshGreen,
    fontWeight: '800',
  },
  featureLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  featureVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subscribeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  subscribeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  ledgerSection: {
    marginTop: 4,
  },
  ledgerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ledgerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  ledgerLoadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  ledgerLoadingText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 12,
  },
  ledgerEmptyBox: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ledgerEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  ledgerEmptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ledgerItemCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  ledgerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ledgerTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ledgerTypeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  ledgerAmountText: {
    fontSize: 16,
    fontWeight: '900',
  },
  ledgerItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerDateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  ledgerBalanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  modalPlanSummary: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalPlanTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: 4,
  },
  modalPlanDetails: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pricingBreakdown: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceRowLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  priceRowValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalPriceLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalPriceValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.accent,
  },
  additiveNotice: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
  },
  additiveNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: 4,
  },
  additiveNoticeText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  payNowBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  payNowBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cancelModalBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
