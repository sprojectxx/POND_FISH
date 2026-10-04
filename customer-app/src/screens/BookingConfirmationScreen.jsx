/**
 * PondFish Booking Confirmation & QR Pickup Ticket Screen (CP-07)
 * Traceability: PondFish Page-by-Page UI Specification (Sections 45-48) & Core Engines Spec (Section 15)
 * Secure digital pickup ticket with 48-hour lifecycle countdown and store instructions.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';

export default function BookingConfirmationScreen({ routeParams = {}, onNavigate }) {
  const booking = routeParams.booking || {};
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(booking.status === 'CANCELLED');
  const isCompleted = booking.status === 'COMPLETED';
  const isPendingCollection = booking.status === 'PENDING_COLLECTION';

  const expiresAt = booking.expires_at ? new Date(booking.expires_at) : null;
  const isExpired = expiresAt && expiresAt < new Date() && !isCompleted && !cancelled;

  const [timeLeft, setTimeLeft] = useState('');
  const [isExpiredLive, setIsExpiredLive] = useState(isExpired);

  useEffect(() => {
    if (!expiresAt || isCompleted || cancelled) return;

    function updateCountdown() {
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      if (diffMs <= 0) {
        setIsExpiredLive(true);
        setTimeLeft('Expired');
        return;
      }
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s remaining`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isCompleted, cancelled]);

  async function handleCancelBooking() {
    Alert.alert(
      'Cancel Booking Reservation',
      'Are you sure you want to cancel this booking? Reserved fish will be returned to store stock, and subscription benefits and payment value will be restored.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel Reservation',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.cancelBooking(booking.id);
              setCancelled(true);
              Alert.alert(
                'Booking Cancelled',
                'Your booking has been cancelled successfully. Your applicable booking benefits and payment value have been restored according to PondFish policy.'
              );
            } catch (err) {
              Alert.alert('Cancellation Error', err.message || 'Unable to cancel booking.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }

  const items = booking.items || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate('HOME')}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.appBarTitle}>Digital Pickup Ticket</Text>
          <Text style={styles.appBarSubtitle}>Present at PondFish Store</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Hero Card */}
        <View style={[styles.heroCard, cancelled && styles.heroCardCancelled]}>
          <Text style={styles.heroEmoji}>
            {isCompleted ? '✅' : cancelled ? '❌' : isExpired ? '⏰' : isPendingCollection ? '🔪' : '🐟'}
          </Text>
          <Text style={styles.heroTitle}>
            {isCompleted
              ? 'Order Collected & Fulfilled!'
              : cancelled
              ? 'Reservation Cancelled'
              : isExpired
              ? 'Booking Expired'
              : isPendingCollection
              ? 'Catch Being Prepared!'
              : 'Catch Reserved Successfully!'}
          </Text>
          <Text style={styles.heroSub}>
            {isCompleted
              ? 'Your fresh fish has been collected from the store. Thank you!'
              : cancelled
              ? 'Reserved fish has been released back to available inventory.'
              : isExpired
              ? 'The 48-hour pickup window has lapsed.'
              : isPendingCollection
              ? 'The store worker is currently cleaning and packing your reserved catch.'
              : 'Your fresh fish has been reserved. Show this ticket upon arrival.'}
          </Text>

          <View style={styles.codeBadge}>
            <Text style={styles.codeLabel}>BOOKING REFERENCE</Text>
            <Text style={styles.codeValue}>{booking.booking_code || 'PENDING'}</Text>
          </View>
        </View>

        {/* QR Ticket Container */}
        <View style={[styles.qrContainer, (cancelled || isExpired || isCompleted) && styles.qrDisabled]}>
          <View style={styles.qrHeader}>
            <Text style={styles.qrTitle}>STORE PICKUP QR CODE</Text>
            <Text
              style={[
                styles.qrStatusTag,
                isCompleted
                  ? styles.tagGreen
                  : cancelled
                  ? styles.tagRed
                  : isExpired
                  ? styles.tagGrey
                  : isPendingCollection
                  ? styles.tagYellow
                  : styles.tagGreen,
              ]}
            >
              {isCompleted
                ? 'COLLECTED / FULFILLED'
                : cancelled
                ? 'INVALID / CANCELLED'
                : isExpired
                ? 'EXPIRED'
                : isPendingCollection
                ? 'PREPARING FOR PICKUP'
                : 'ACTIVE TICKET'}
            </Text>
          </View>

          {/* QR Graphical Simulated Pattern */}
          <View style={[styles.qrBox, (isCompleted || cancelled || isExpired) && { opacity: 0.35 }]}>
            <View style={styles.qrCornerTL} />
            <View style={styles.qrCornerTR} />
            <View style={styles.qrCornerBL} />
            <View style={styles.qrMatrixPattern}>
              <Text style={styles.qrMatrixGlyphs}>
                ███  ███  █  ███  ███{'\n'}
                █ █  █ █  █  █ █  █ █{'\n'}
                ███  ███  █  ███  ███{'\n'}
                █████████████████████{'\n'}
                █  █  ██  █  ██  █  █{'\n'}
                █████████████████████{'\n'}
                ███  ███  █  ███  ███{'\n'}
                █ █  █ █  █  █ █  █ █{'\n'}
                ███  ███  █  ███  ███
              </Text>
            </View>
            {isCompleted && (
              <View style={styles.qrRedeemedOverlay}>
                <Text style={styles.qrRedeemedText}>REDEEMED</Text>
              </View>
            )}
          </View>

          {/* Cryptographic Token Reference */}
          <View style={styles.tokenBox}>
            <Text style={styles.tokenLabel}>SECURE VERIFICATION TOKEN:</Text>
            <Text style={styles.tokenValue} numberOfLines={2} ellipsizeMode="middle">
              {booking.qr_code_data || 'Generating secure signature...'}
            </Text>
          </View>

          {/* 48-Hour Lifecycle Countdown Notice */}
          <View style={[styles.expiryRow, (isExpired || isExpiredLive) && styles.expiryRowExpired]}>
            <Text style={styles.expiryIcon}>⏱️</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={[styles.expiryTitle, (isExpired || isExpiredLive) && { color: colors.freshRed }]}>
                  48-Hour Collection Window
                </Text>
                {Boolean(timeLeft) && !isCompleted && !cancelled && (
                  <View style={[styles.countdownBadge, (isExpired || isExpiredLive) ? styles.countdownBadgeExpired : styles.countdownBadgeActive]}>
                    <Text style={styles.countdownBadgeText}>{timeLeft}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.expiryTime, (isExpired || isExpiredLive) && { color: '#EF4444' }]}>
                Valid until: {expiresAt ? expiresAt.toLocaleString('en-IN') : '48 hours from confirmation'}
              </Text>
            </View>
          </View>
        </View>

        {/* Pickup Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionHeading}>Pickup Instructions</Text>
          <Text style={styles.instructionStep}>1. Visit the PondFish store at your convenience within 48 hours.</Text>
          <Text style={styles.instructionStep}>2. Present this QR code to the store counter worker.</Text>
          <Text style={styles.instructionStep}>3. Your reserved catch will be descaled, cut, and packed fresh upon scan.</Text>
        </View>

        {/* Items Summary */}
        {items.length > 0 && (
          <View style={styles.itemsCard}>
            <Text style={styles.itemsTitle}>Reserved Items ({items.length})</Text>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View>
                  <Text style={styles.itemName}>{item.fish_name}</Text>
                  <Text style={styles.itemQty}>{item.quantity_kg} kg @ ₹{item.unit_price}/kg</Text>
                </View>
                <Text style={styles.itemTotal}>₹{item.subtotal}</Text>
              </View>
            ))}

            <View style={styles.financialRow}>
              <Text style={styles.finLabel}>Total Order Value</Text>
              <Text style={styles.finVal}>₹{booking.total_amount}</Text>
            </View>
            {booking.sub_credit_used > 0 && (
              <View style={styles.financialRow}>
                <Text style={styles.finLabel}>Subscription Credit Applied</Text>
                <Text style={[styles.finVal, { color: colors.freshGreen }]}>
                  -₹{booking.sub_credit_used}
                </Text>
              </View>
            )}
            <View style={[styles.financialRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.finLabel, { fontWeight: '800' }]}>Paid Online</Text>
              <Text style={[styles.finVal, { fontWeight: '900', color: colors.accent }]}>
                ₹{booking.razorpay_paid || 0}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionColumn}>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => onNavigate('MARKETPLACE')}
            activeOpacity={0.8}
          >
            <Text style={styles.homeBtnText}>Continue Browsing Marketplace</Text>
          </TouchableOpacity>

          {!cancelled && !isExpired && !isCompleted && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancelBooking}
              disabled={cancelling}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>
                {cancelling ? 'Releasing Reservation...' : 'Cancel This Reservation'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
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
  heroCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.4)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    textAlign: 'center',
  },
  heroCardCancelled: {
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  heroEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  codeBadge: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  codeValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 1,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  qrDisabled: {
    opacity: 0.4,
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  qrTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  qrStatusTag: {
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagGreen: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  tagYellow: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  tagRed: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  tagGrey: {
    backgroundColor: '#E2E8F0',
    color: '#475569',
  },
  qrBox: {
    width: 200,
    height: 200,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  qrCornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderWidth: 4,
    borderColor: '#0F172A',
  },
  qrCornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderWidth: 4,
    borderColor: '#0F172A',
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 32,
    height: 32,
    borderWidth: 4,
    borderColor: '#0F172A',
  },
  qrMatrixPattern: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrMatrixGlyphs: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 16,
    letterSpacing: 2,
  },
  qrRedeemedOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  qrRedeemedText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
  },
  tokenBox: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  tokenLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
  },
  tokenValue: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#0F172A',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  expiryIcon: {
    fontSize: 18,
  },
  expiryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  expiryTime: {
    fontSize: 11,
    color: '#B45309',
  },
  expiryRowExpired: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  countdownBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countdownBadgeActive: {
    backgroundColor: '#D97706',
  },
  countdownBadgeExpired: {
    backgroundColor: colors.freshRed,
  },
  countdownBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  instructionsCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  instructionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  instructionStep: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  itemsCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemQty: {
    fontSize: 11,
    color: colors.textMuted,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  finLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  finVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionColumn: {
    gap: 10,
    marginTop: 4,
  },
  homeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  homeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  cancelBtnText: {
    color: colors.freshRed,
    fontWeight: '700',
    fontSize: 13,
  },
});
