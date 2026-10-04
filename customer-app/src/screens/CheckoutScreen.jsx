/**
 * PondFish Customer Checkout & Reservation Screen (CP-06)
 * Traceability: PondFish Page-by-Page UI Specification (Sections 34-44) & Core Engines Spec (Section 13, 14)
 * Server-authoritative checkout calculation, subscription credit display,
 * inventory verification, and payment gateway boundary.
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
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';

export default function CheckoutScreen({ onNavigate, onCartUpdated }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCheckoutPreview();
      setPreview(res.data);
    } catch (err) {
      if (err.code === 'EMPTY_CART') {
        setError('EMPTY_CART');
      } else {
        setError(err.message || 'Unable to prepare checkout at this time.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  async function handleConfirmBooking() {
    if (!acknowledged) {
      Alert.alert(
        'Confirmation Required',
        'Please confirm that you understand booked fish will be prepared after QR verification at the store.'
      );
      return;
    }

    if (!preview) return;

    // Check inventory availability
    if (!preview.inventory.isAvailable) {
      Alert.alert(
        'Stock Unavailable',
        'One or more items in your cart exceed currently available inventory. Please adjust quantities in your cart.'
      );
      return;
    }

    const paymentRequired = preview.summary.finalPayableAmount > 0;

    // If payment required and gateway not configured: transparently explain boundary
    if (paymentRequired && !preview.paymentGateway.configured) {
      Alert.alert(
        'Payment Gateway Unavailable',
        `An online payment of ₹${preview.summary.finalPayableAmount} is required, but genuine Razorpay credentials are not configured in this environment. Fake payment verification is strictly prohibited.`,
        [
          { text: 'Back to Cart', onPress: () => onNavigate('CART') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    setSubmitting(true);
    try {
      let paymentVerification = null;

      if (paymentRequired) {
        // Real Razorpay flow would be invoked here with order ID
        const orderRes = await api.createRazorpayOrder();
        if (!orderRes.configured) {
          Alert.alert('Payment Boundary', orderRes.message);
          setSubmitting(false);
          return;
        }
        // In real Android build, Razorpay Checkout SDK opens here
        // If not completed: throw payment cancelled
        throw new Error('Razorpay Checkout requires genuine Android API keys.');
      }

      // Execute booking creation (fully covered by subscription or verified payment)
      const res = await api.createBooking(paymentVerification);

      if (onCartUpdated) {
        onCartUpdated({ items: [], summary: { totalItems: 0, totalQuantity: 0, totalAmount: 0 } });
      }

      onNavigate('BOOKING_CONFIRMATION', { booking: res.data });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_INVENTORY') {
        Alert.alert(
          'Inventory Changed',
          'Stock changed while you were checking out. The requested quantity is no longer available.',
          [{ text: 'Return to Cart', onPress: () => onNavigate('CART') }]
        );
      } else if (err.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
        Alert.alert('Payment Unavailable', err.message);
      } else {
        Alert.alert('Booking Notice', err.message || 'Unable to finalize booking.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Calculating authoritative checkout...</Text>
      </View>
    );
  }

  if (error === 'EMPTY_CART') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyEmoji}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add fresh fish from the marketplace to proceed to checkout.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => onNavigate('MARKETPLACE')}>
          <Text style={styles.primaryBtnText}>Browse Fish Marketplace</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorTitle}>Checkout Error</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={fetchPreview}>
          <Text style={styles.primaryBtnText}>Retry Checkout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { items, summary, subscription, inventory, paymentGateway } = preview;
  const paymentRequired = summary.finalPayableAmount > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* Top Header */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate('CART')}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.appBarTitle}>Booking Checkout</Text>
          <Text style={styles.appBarSubtitle}>Authoritative server calculation</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Inventory Warning Banner if stock insufficient */}
        {!inventory.isAvailable && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningBannerTitle}>⚠️ Insufficient Available Stock</Text>
            {inventory.issues.map((issue, idx) => (
              <Text key={idx} style={styles.warningBannerText}>
                • {issue.message}
              </Text>
            ))}
            <TouchableOpacity style={styles.adjustCartBtn} onPress={() => onNavigate('CART')}>
              <Text style={styles.adjustCartBtnText}>Return to Cart to Adjust Quantities</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section 1: Reserved Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Catch Reservation ({items.length} varieties)</Text>
          {items.map((item) => (
            <View key={item.fishId} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCategory}>{item.categoryName}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantityKg} kg × ₹{item.effectivePrice}/kg
                </Text>

                {/* Stock Badge */}
                <View style={styles.stockBadgeContainer}>
                  <Text
                    style={[
                      styles.stockBadge,
                      item.isStockSufficient ? styles.stockOk : styles.stockBad,
                    ]}
                  >
                    {item.isStockSufficient
                      ? `✓ ${item.availableStockKg} kg in stock`
                      : `✗ Out of stock (${item.availableStockKg} kg avail)`}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemPrice}>₹{item.subtotal}</Text>
                {item.subscriptionCoveredKg > 0 && (
                  <Text style={styles.coveredBadge}>
                    Covered: {item.subscriptionCoveredKg} kg
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Section 2: Subscription Coverage Status */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Subscription Coverage</Text>
            <Text style={[styles.subStatusBadge, subscription.active ? styles.subActive : styles.subInactive]}>
              {subscription.active ? 'ACTIVE' : 'NO SUBSCRIPTION'}
            </Text>
          </View>

          {subscription.active ? (
            <View style={styles.subDetails}>
              <Text style={styles.subPlanTitle}>{subscription.planTitle}</Text>
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Weekly Fish Allowance:</Text>
                <Text style={styles.subValue}>
                  {subscription.remainingWeeklyKg} kg remaining (of {subscription.weeklyLimitKg} kg)
                </Text>
              </View>
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Subscription Credit:</Text>
                <Text style={styles.subValue}>₹{subscription.creditBalance}</Text>
              </View>
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Credit Used for this Order:</Text>
                <Text style={[styles.subValue, { color: colors.freshGreen }]}>
                  -₹{summary.subscriptionCreditUsed}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noSubBox}>
              <Text style={styles.noSubTitle}>Non-Subscription Customer</Text>
              <Text style={styles.noSubText}>
                Subscription is not mandatory. You can proceed with full online payment.
              </Text>
            </View>
          )}
        </View>

        {/* Section 3: Financial Summary & Fees */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Breakdown</Text>

          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Items Gross Total</Text>
            <Text style={styles.feeVal}>₹{summary.subtotal}</Text>
          </View>

          {summary.subscriptionCreditUsed > 0 && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Subscription Credit Deduction</Text>
              <Text style={[styles.feeVal, { color: colors.freshGreen }]}>
                -₹{summary.subscriptionCreditUsed}
              </Text>
            </View>
          )}

          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Payable Base Amount</Text>
            <Text style={styles.feeVal}>₹{summary.basePayableAmount}</Text>
          </View>

          {paymentRequired && (
            <>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Payment Gateway Fee ({summary.gatewayFeeRatePercent}%)</Text>
                <Text style={styles.feeVal}>₹{summary.gatewayFee}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>GST on Gateway Fee ({summary.gstRatePercent}%)</Text>
                <Text style={styles.feeVal}>₹{summary.feeGst}</Text>
              </View>
            </>
          )}

          <View style={[styles.feeRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Payable Online</Text>
            <Text style={styles.totalVal}>₹{summary.finalPayableAmount}</Text>
          </View>

          {/* Gateway Status Note */}
          {paymentRequired && !paymentGateway.configured && (
            <View style={styles.gatewayWarningBox}>
              <Text style={styles.gatewayWarningTitle}>Notice: Payment Adapter Unconfigured</Text>
              <Text style={styles.gatewayWarningText}>
                Genuine Razorpay production credentials are not provided. The system will not simulate or fake a payment.
              </Text>
            </View>
          )}
        </View>

        {/* Section 4: Store Pickup Acknowledgement */}
        <TouchableOpacity
          style={styles.ackBox}
          activeOpacity={0.8}
          onPress={() => setAcknowledged(!acknowledged)}
        >
          <View style={[styles.checkbox, acknowledged && styles.checkboxActive]}>
            {acknowledged && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.ackText}>
            I confirm my booking details. I understand that booked fish will be prepared after QR verification at the store, with a strict 48-hour pickup window.
          </Text>
        </TouchableOpacity>

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.bookButton,
            (!acknowledged || !inventory.isAvailable || submitting) && styles.bookButtonDisabled,
          ]}
          onPress={handleConfirmBooking}
          disabled={!acknowledged || !inventory.isAvailable || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.bookButtonText}>
              {paymentRequired
                ? `Pay ₹${summary.finalPayableAmount} & Reserve Catch →`
                : 'Confirm & Reserve Catch (Subscription Covered) →'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    fontSize: 14,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.freshRed,
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
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
    fontSize: 12,
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  warningBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: colors.freshRed,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  warningBannerTitle: {
    color: colors.freshRed,
    fontWeight: '800',
    fontSize: 14,
  },
  warningBannerText: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  adjustCartBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.freshRed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  adjustCartBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.4)',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemCategory: {
    fontSize: 12,
    color: colors.textMuted,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stockBadgeContainer: {
    marginTop: 4,
  },
  stockBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  stockOk: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    color: colors.freshGreen,
  },
  stockBad: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    color: colors.freshRed,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  coveredBadge: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  subStatusBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subActive: {
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    color: colors.freshGreen,
  },
  subInactive: {
    backgroundColor: colors.bgSurface,
    color: colors.textMuted,
  },
  subDetails: {
    gap: 6,
  },
  subPlanTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 4,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  subValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  noSubBox: {
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    padding: 12,
  },
  noSubTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  noSubText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  feeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  feeVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.accent,
  },
  gatewayWarningBox: {
    marginTop: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    padding: 10,
  },
  gatewayWarningTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  gatewayWarningText: {
    color: '#FDE68A',
    fontSize: 11,
    marginTop: 2,
  },
  ackBox: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  ackText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  bookButtonDisabled: {
    opacity: 0.4,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
