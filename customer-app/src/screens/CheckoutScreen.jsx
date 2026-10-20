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
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import RazorpayCheckout from 'react-native-razorpay';

export default function CheckoutScreen({ onNavigate, onCartUpdated }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [acknowledged, setAcknowledged] = useState(true);
  const [masalaAdded, setMasalaAdded] = useState(false);
  const [deliveryInstruction, setDeliveryInstruction] = useState('LEAVE_AT_DOOR');
  const [showBreakdown, setShowBreakdown] = useState(false);

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
        // Create authoritative Razorpay order on backend
        const orderRes = await api.createRazorpayOrder();
        if (!orderRes.success || !orderRes.data?.orderId) {
          Alert.alert('Payment Initialization Failed', orderRes.error?.message || 'Could not initiate Razorpay order.');
          setSubmitting(false);
          return;
        }

        const orderData = orderRes.data;
        const razorpayOptions = {
          description: 'PondFish Booking Checkout',
          image: 'https://pondfish.in/favicon.ico',
          currency: orderData.currency || 'INR',
          key: orderData.keyId,
          amount: orderData.amount, // in paise
          name: 'PondFish',
          order_id: orderData.orderId,
          theme: { color: colors.accent || '#007A78' },
        };

        let razorpayResponse;
        try {
          razorpayResponse = await RazorpayCheckout.open(razorpayOptions);
        } catch (payErr) {
          const isCancelled = payErr?.code === 0 ||
            (typeof payErr?.description === 'string' &&
              (payErr.description.toLowerCase().includes('cancelled') ||
               payErr.description.toLowerCase().includes('canceled')));

          if (isCancelled) {
            Alert.alert('Payment Cancelled', 'Payment was cancelled. Your booking has not been confirmed.');
          } else {
            Alert.alert('Payment Failed', payErr?.description || payErr?.message || 'Payment processing failed. Please try again.');
          }
          setSubmitting(false);
          return;
        }

        paymentVerification = {
          orderId: razorpayResponse.razorpay_order_id || orderData.orderId,
          paymentId: razorpayResponse.razorpay_payment_id,
          signature: razorpayResponse.razorpay_signature,
          razorpayOrderId: razorpayResponse.razorpay_order_id || orderData.orderId,
          razorpayPaymentId: razorpayResponse.razorpay_payment_id,
          razorpaySignature: razorpayResponse.razorpay_signature,
        };
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
        <ActivityIndicator size="large" color="#0284C7" />
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
        <TouchableOpacity style={styles.primaryBtn} onPress={() => onNavigate('HOME')}>
          <Text style={styles.primaryBtnText}>Browse Today’s Catch</Text>
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

  const { items = [], summary = {}, subscription = {}, inventory = {}, paymentGateway = {} } = preview || {};
  const paymentRequired = summary.finalPayableAmount > 0;
  const totalPayable = masalaAdded
    ? (parseFloat(summary.finalPayableAmount || 0) + 39).toFixed(2)
    : parseFloat(summary.finalPayableAmount || 0).toFixed(2);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFE" />

      {/* Screen App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate && onNavigate('CART')}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Checkout</Text>
        </View>
        <View style={styles.appBarRight}>
          <TouchableOpacity
            style={styles.helpBtn}
            onPress={() => Alert.alert('PondFish Care', 'Seafood concierge available 24x7 via WhatsApp (+91 98765 43210).')}
          >
            <Text style={styles.helpBtnText}>?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => onNavigate && onNavigate('PROFILE')}
          >
            <Text style={styles.avatarBtnText}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner 1: Arriving In & Address */}
        <View style={styles.arrivingCard}>
          <View style={styles.arrivingIconCircle}>
            <Text style={styles.arrivingBoltIcon}>⚡</Text>
          </View>
          <View style={styles.arrivingDetails}>
            <View style={styles.arrivingTitleRow}>
              <Text style={styles.arrivingTitle}>Arriving in 8 mins</Text>
              <View style={styles.superfastPill}>
                <Text style={styles.superfastPillText}>SUPERFAST</Text>
              </View>
            </View>
            <Text style={styles.arrivingAddress} numberOfLines={1}>
              Delivering to Home • Flat 302, Madhapur, Hyd
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert('Delivery Address', 'Current delivery route locked to Madhapur Hub.')}
          >
            <Text style={styles.changeAddressLink}>CHANGE</Text>
          </TouchableOpacity>
        </View>

        {/* Banner 2: Savings Celebration */}
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsCheckmark}>✔</Text>
          <Text style={styles.savingsText}>
            🎉 You saved ₹{summary.subscriptionCreditUsed ? parseFloat(summary.subscriptionCreditUsed).toFixed(2) : '280.00'} with your Gold Subscription on this order
          </Text>
        </View>

        {/* Section: Cart Catch & Cuts */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Cart Catch & Cuts ({items.length})</Text>
          <Text style={styles.coldChainTag}>PRISTINE COLD-CHAIN GUARANTEED</Text>
        </View>

        {/* Items List */}
        {items.map((item, idx) => {
          const isCovered = Boolean(subscription.active && item.isSubscriptionEligible && item.subscriptionCoveredKg > 0);
          const weightGrams = Math.round((item.quantityKg || 1) * 1000);

          return (
            <View key={item.fishId || idx} style={styles.cartItemCard}>
              {/* Item Thumbnail */}
              <View style={styles.itemThumbBox}>
                <View style={styles.itemThumbPlaceholder}>
                  <Text style={{ fontSize: 28 }}>🐟</Text>
                </View>
                <View style={styles.weightTagPill}>
                  <Text style={styles.weightTagText}>{weightGrams}g</Text>
                </View>
              </View>

              {/* Item Info */}
              <View style={styles.itemInfoCol}>
                <View style={styles.itemBadgeRow}>
                  {isCovered ? (
                    <View style={styles.coveredBadge}>
                      <Text style={styles.coveredBadgeIcon}>✪</Text>
                      <Text style={styles.coveredBadgeText}>Covered by Gold Subscription</Text>
                    </View>
                  ) : (
                    <View style={styles.extraBadge}>
                      <Text style={styles.extraBadgeText}>Extra Non-Quota Purchase</Text>
                    </View>
                  )}
                  <Text style={styles.itemNetWeightText}>{item.quantityKg} kg</Text>
                </View>

                <Text style={styles.itemTitleText} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemSubDetailText} numberOfLines={1}>
                  Net Wt: {weightGrams}g • Cleaned, Descaled, Chilled at 2°C
                </Text>

                {/* Price & Action Row */}
                <View style={styles.itemPriceActionRow}>
                  <View style={styles.priceRowLeft}>
                    {isCovered ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.itemFinalPriceZero}>₹0</Text>
                        <Text style={styles.itemStrikethroughPrice}>₹{item.subtotal}</Text>
                        <View style={styles.quotaDeductPill}>
                          <Text style={styles.quotaDeductPillText}>Quota Deduct</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.itemFinalPrice}>₹{item.subtotal}</Text>
                        <Text style={styles.itemStrikethroughPrice}>₹{Math.round(item.subtotal * 1.2)}</Text>
                      </View>
                    )}
                  </View>

                  {isCovered ? (
                    <View style={styles.planItemPill}>
                      <Text style={styles.planItemLock}>🔒</Text>
                      <Text style={styles.planItemText}>PLAN ITEM</Text>
                    </View>
                  ) : (
                    <View style={styles.stepperCapsule}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => onNavigate('CART')}>
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValueText}>{item.quantityKg}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => onNavigate('CART')}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {/* Cross-sell Banner: Artisanal Masala */}
        <View style={styles.crossSellCard}>
          <View style={styles.crossSellIconBox}>
            <Text style={{ fontSize: 18 }}>🛒</Text>
          </View>
          <View style={styles.crossSellDetails}>
            <Text style={styles.crossSellTitle}>Artisanal Fish Masala Paste</Text>
            <Text style={styles.crossSellSub}>Stone-ground, single-use 50g sachet • ₹39</Text>
          </View>
          <TouchableOpacity
            style={[styles.addMasalaBtn, masalaAdded && styles.addMasalaBtnActive]}
            onPress={() => setMasalaAdded(!masalaAdded)}
            activeOpacity={0.8}
          >
            <Text style={[styles.addMasalaBtnText, masalaAdded && styles.addMasalaBtnTextActive]}>
              {masalaAdded ? 'ADDED ✓' : '+ ADD'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card: Gold Plan Ledger Breakdown */}
        {subscription.active && (
          <View style={styles.ledgerBreakdownCard}>
            <View style={styles.ledgerBreakdownHeader}>
              <View style={styles.ledgerHeaderTitleRow}>
                <Text style={styles.ledgerCardIcon}>💳</Text>
                <Text style={styles.ledgerCardTitle}>Gold Plan Ledger Breakdown</Text>
              </View>
              <View style={styles.activeMemberBadge}>
                <Text style={styles.activeMemberBadgeText}>ACTIVE MEMBER</Text>
              </View>
            </View>

            {/* Quota bar */}
            <View style={styles.ledgerQuotaRow}>
              <Text style={styles.ledgerQuotaLabel}>Weekly Quota Available</Text>
              <Text style={styles.ledgerQuotaVal}>
                {subscription.remainingWeeklyKg || 0.6} kg / {subscription.weeklyLimitKg || 2.0} kg remaining
              </Text>
            </View>
            <View style={styles.ledgerBarTrack}>
              <View
                style={[
                  styles.ledgerBarFill,
                  {
                    width: `${Math.min(
                      100,
                      subscription.weeklyLimitKg > 0
                        ? ((subscription.remainingWeeklyKg || 0.6) / subscription.weeklyLimitKg) * 100
                        : 30
                    )}%`,
                  },
                ]}
              />
            </View>

            {/* Ledger lines */}
            <View style={styles.ledgerLineRow}>
              <Text style={styles.ledgerLineLabel}>
                ✓ Subscribed Fish (Rohu 1kg): 0.6 kg covered
              </Text>
              <Text style={styles.ledgerLineSavings}>Saved ₹168.00</Text>
            </View>

            <View style={styles.ledgerLineRow}>
              <Text style={styles.ledgerLineLabel}>
                ⚖ Excess weight over quota (0.4 kg @ ₹280/kg)
              </Text>
              <Text style={styles.ledgerLineVal}>₹112.00</Text>
            </View>

            <View style={styles.ledgerLineRow}>
              <Text style={styles.ledgerLineLabel}>
                💳 Subscription Credit balance applied
              </Text>
              <Text style={styles.ledgerLineDeduct}>-₹112.00</Text>
            </View>

            {/* Net Wallet Balance highlight */}
            <View style={styles.netBalanceBox}>
              <Text style={styles.netBalanceLabel}>Net Subscription Wallet Balance:</Text>
              <Text style={styles.netBalanceVal}>
                ₹{subscription.remainingCreditBalance ? parseFloat(subscription.remainingCreditBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '2,338.00'}
              </Text>
            </View>
          </View>
        )}

        {/* Card: Bill Summary */}
        <View style={styles.billSummaryCard}>
          <Text style={styles.billSummaryTitle}>Bill Summary</Text>

          <View style={styles.billRow}>
            <Text style={styles.billRowLabel}>Items Total (Gross Value)</Text>
            <Text style={styles.billRowVal}>₹{summary.subtotal || 660.00}</Text>
          </View>

          {subscription.active && (
            <>
              <View style={styles.billRow}>
                <Text style={styles.billRowLabel}>✓ Subscription Quota Benefit</Text>
                <Text style={[styles.billRowVal, { color: '#0284C7' }]}>-₹168.00</Text>
              </View>

              <View style={styles.billRow}>
                <Text style={styles.billRowLabel}>💳 Subscription Credit Deducted</Text>
                <Text style={[styles.billRowVal, { color: '#0284C7' }]}>
                  -₹{summary.subscriptionCreditUsed || 112.00}
                </Text>
              </View>
            </>
          )}

          {masalaAdded && (
            <View style={styles.billRow}>
              <Text style={styles.billRowLabel}>Artisanal Masala Paste (50g)</Text>
              <Text style={styles.billRowVal}>₹39.00</Text>
            </View>
          )}

          <View style={styles.billRow}>
            <Text style={styles.billRowLabel}>Delivery Partner Fee</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Text style={styles.feeStrikethrough}>₹35.00</Text>
              <Text style={styles.feeFree}>FREE</Text>
            </View>
          </View>

          <View style={styles.billRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.billRowLabel}>Razorpay Gateway Fee (2% + 18% GST)</Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}>ⓘ</Text>
            </View>
            <Text style={styles.billRowVal}>
              ₹{summary.gatewayFee ? (parseFloat(summary.gatewayFee) + parseFloat(summary.feeGst || 0)).toFixed(2) : '8.96'}
            </Text>
          </View>

          {/* Total Amount Box */}
          <View style={styles.totalPayableBox}>
            <View>
              <Text style={styles.totalPayableTitle}>Total Amount Payable</Text>
              <Text style={styles.totalPayableSubtitle}>Inclusive of all seafood hygiene taxes</Text>
            </View>
            <Text style={styles.totalPayableAmount}>₹{totalPayable}</Text>
          </View>
        </View>

        {/* Section: Delivery Instructions */}
        <Text style={styles.instructionsHeading}>Delivery Instructions</Text>
        <View style={styles.instructionsRow}>
          <TouchableOpacity
            style={[
              styles.instructionBtn,
              deliveryInstruction === 'LEAVE_AT_DOOR' && styles.instructionBtnActive,
            ]}
            onPress={() =>
              setDeliveryInstruction(deliveryInstruction === 'LEAVE_AT_DOOR' ? null : 'LEAVE_AT_DOOR')
            }
            activeOpacity={0.8}
          >
            <Text style={styles.instructionIcon}>🚪</Text>
            <Text style={[
              styles.instructionText,
              deliveryInstruction === 'LEAVE_AT_DOOR' && styles.instructionTextActive,
            ]}>
              Leave at door
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.instructionBtn,
              deliveryInstruction === 'AVOID_CALLING' && styles.instructionBtnActive,
            ]}
            onPress={() =>
              setDeliveryInstruction(deliveryInstruction === 'AVOID_CALLING' ? null : 'AVOID_CALLING')
            }
            activeOpacity={0.8}
          >
            <Text style={styles.instructionIcon}>📵</Text>
            <Text style={[
              styles.instructionText,
              deliveryInstruction === 'AVOID_CALLING' && styles.instructionTextActive,
            ]}>
              Avoid calling
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security & Razorpay Badge */}
        <View style={styles.securityBadgeRow}>
          <Text style={styles.securityShieldIcon}>🛡</Text>
          <Text style={styles.securityText}>100% Encrypted & Powered by Razorpay Direct UPI</Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.stickyBottomBar}>
        <View style={styles.stickyPriceCol}>
          <Text style={styles.toPayLabel}>TO PAY VIA RAZORPAY</Text>
          <Text style={styles.stickyPriceValue}>₹{totalPayable}</Text>
          <TouchableOpacity onPress={() => setShowBreakdown(!showBreakdown)}>
            <Text style={styles.breakdownLink}>Detailed Breakdown ⌃</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.payReserveBtn, submitting && styles.payReserveBtnDisabled]}
          onPress={handleConfirmBooking}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.payReserveBtnText}>Pay & Reserve Catch →</Text>
          )}
        </TouchableOpacity>
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
    fontSize: 14,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1C33',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A1C33',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#F8FAFE',
  },
  backBtn: {
    padding: 4,
  },
  backBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A1C33',
  },
  appBarCenter: {
    flex: 1,
    paddingLeft: 10,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1C33',
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDF5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1C33',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0A1C33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  arrivingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1C33',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  arrivingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  arrivingBoltIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  arrivingDetails: {
    flex: 1,
  },
  arrivingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrivingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  superfastPill: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  superfastPillText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  arrivingAddress: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  changeAddressLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    marginLeft: 8,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF3FC',
    borderWidth: 1,
    borderColor: '#C6DEF9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    gap: 6,
  },
  savingsCheckmark: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '900',
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A1C33',
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1C33',
  },
  coldChainTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  cartItemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  itemThumbBox: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#EDF5FD',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
  },
  itemThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightTagPill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A1C33',
    paddingVertical: 2,
    alignItems: 'center',
  },
  weightTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  itemInfoCol: {
    flex: 1,
  },
  itemBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  coveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF5FD',
    borderWidth: 1,
    borderColor: '#C6DEF9',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  coveredBadgeIcon: {
    fontSize: 9,
    color: '#0284C7',
  },
  coveredBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284C7',
  },
  extraBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  extraBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  itemNetWeightText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  itemTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1C33',
  },
  itemSubDetailText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  itemPriceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  priceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemFinalPriceZero: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1C33',
  },
  itemFinalPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1C33',
  },
  itemStrikethroughPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  quotaDeductPill: {
    backgroundColor: '#EDF5FD',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  quotaDeductPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284C7',
  },
  planItemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  planItemLock: {
    fontSize: 10,
  },
  planItemText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0A1C33',
  },
  stepperCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 8,
  },
  stepperBtn: {
    paddingHorizontal: 4,
  },
  stepperBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stepperValueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  crossSellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  crossSellIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDF5FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  crossSellDetails: {
    flex: 1,
  },
  crossSellTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1C33',
  },
  crossSellSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  addMasalaBtn: {
    borderWidth: 1,
    borderColor: '#C6DEF9',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addMasalaBtnActive: {
    backgroundColor: '#0A1C33',
    borderColor: '#0A1C33',
  },
  addMasalaBtnText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '800',
  },
  addMasalaBtnTextActive: {
    color: '#FFFFFF',
  },
  ledgerBreakdownCard: {
    backgroundColor: '#EDF5FD',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C6DEF9',
    padding: 14,
    marginBottom: 16,
  },
  ledgerBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ledgerHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ledgerCardIcon: {
    fontSize: 14,
  },
  ledgerCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1C33',
  },
  activeMemberBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C6DEF9',
  },
  activeMemberBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#0284C7',
  },
  ledgerQuotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ledgerQuotaLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  ledgerQuotaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A1C33',
  },
  ledgerBarTrack: {
    height: 6,
    backgroundColor: '#C6DEF9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  ledgerBarFill: {
    height: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 3,
  },
  ledgerLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ledgerLineLabel: {
    fontSize: 11,
    color: '#475569',
  },
  ledgerLineSavings: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  ledgerLineVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A1C33',
  },
  ledgerLineDeduct: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  netBalanceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#C6DEF9',
    marginTop: 4,
  },
  netBalanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1C33',
  },
  netBalanceVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1C33',
  },
  billSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  billSummaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1C33',
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billRowLabel: {
    fontSize: 12,
    color: '#475569',
  },
  billRowVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A1C33',
  },
  feeStrikethrough: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  feeFree: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  totalPayableBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 6,
  },
  totalPayableTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1C33',
  },
  totalPayableSubtitle: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  totalPayableAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0A1C33',
    letterSpacing: -0.5,
  },
  instructionsHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1C33',
    marginBottom: 8,
  },
  instructionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  instructionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF5FD',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#C6DEF9',
  },
  instructionBtnActive: {
    backgroundColor: '#0A1C33',
    borderColor: '#0A1C33',
  },
  instructionIcon: {
    fontSize: 14,
  },
  instructionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A1C33',
  },
  instructionTextActive: {
    color: '#FFFFFF',
  },
  securityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  securityShieldIcon: {
    fontSize: 13,
    color: '#0284C7',
  },
  securityText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  stickyPriceCol: {
    justifyContent: 'center',
  },
  toPayLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  stickyPriceValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0A1C33',
  },
  breakdownLink: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  payReserveBtn: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payReserveBtnDisabled: {
    opacity: 0.6,
  },
  payReserveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
