/**
 * Screen: CP-18 / CP-11 — Physical Transaction Result Screen
 * Traceability: PondFish Customer Mobile App UI Specification (Sections 89, 90, 91), Master PRD v2 (Section 11.3)
 * 
 * Displays final confirmed transaction receipt following server-authoritative finalization.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';

export default function TransactionResultScreen({ routeParams = {}, onNavigate }) {
  const transaction = routeParams?.transaction || {};

  const items = Array.isArray(transaction.items) ? transaction.items : [];
  const totalBill = transaction.total_bill_amount || transaction.totalBillAmount || 0;
  const subCreditUsed = transaction.sub_credit_used || transaction.subCreditUsed || 0;
  const finalPaid = transaction.final_paid_amount || transaction.finalPaidAmount || 0;
  const paymentMethod = transaction.payment_method || transaction.paymentMethod || 'RAZORPAY';
  const billNumber = transaction.bill_number || transaction.billNumber || 'COUNTER-RECEIPT';
  const txnNumber = transaction.transaction_number || transaction.transactionNumber || 'PF-TXN-COMPLETED';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Icon & Header */}
        <View style={styles.successBox}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Purchase Completed!</Text>
          <Text style={styles.successSub}>
            Your in-store fish transaction has been verified and settled.
          </Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>TRANSACTION COMPLETED</Text>
          </View>
        </View>

        {/* Receipt Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transaction Receipt</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction ID</Text>
            <Text style={styles.detailValueBold}>{txnNumber}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bill Number</Text>
            <Text style={styles.detailValue}>{billNumber}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Method</Text>
            <Text style={styles.detailValue}>
              {paymentMethod === 'SUBSCRIPTION_ONLY' ? 'Subscription Credit' : 'Razorpay UPI/Card'}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Purchased Cuts */}
          <Text style={[styles.detailLabel, { marginBottom: 8 }]}>Items Purchased</Text>
          {items.map((it, idx) => (
            <View key={it.id || idx} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {it.fish_name || it.fishName || 'Fresh Fish'} ({it.quantity_kg || it.quantityKg || 1} kg)
              </Text>
              <Text style={styles.itemPrice}>
                ₹{(it.subtotal || (it.unit_price || it.unitPrice || 0) * (it.quantity_kg || it.quantityKg || 1)).toFixed(2)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* Totals Breakdown */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Bill Amount</Text>
            <Text style={styles.detailValue}>₹{totalBill.toFixed(2)}</Text>
          </View>

          {subCreditUsed > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Subscription Credit Applied</Text>
              <Text style={styles.creditValue}>-₹{subCreditUsed.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.finalRow}>
            <Text style={styles.finalLabel}>Total Paid</Text>
            <Text style={styles.finalAmount}>₹{finalPaid.toFixed(2)}</Text>
          </View>
        </View>

        {/* Realtime TV Broadcast Notice */}
        <View style={styles.noticeCard}>
          <Text style={{ fontSize: 20, marginRight: 10 }}>📺</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Broadcasted to Store TV</Text>
            <Text style={styles.noticeDesc}>
              This order has been broadcasted to the Shop TV Display for order collection.
            </Text>
          </View>
        </View>

        {/* Action CTAs */}
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => onNavigate('TRANSACTION_HISTORY')}
          activeOpacity={0.8}
        >
          <Text style={styles.historyBtnText}>View Transaction History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
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
  content: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  successBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.freshGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  successSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  statusPill: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 12,
  },
  statusPillText: {
    color: colors.freshGreen,
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  creditValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.freshGreen,
  },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  finalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  finalAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.freshGreen,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.10)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    marginBottom: 20,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accent,
  },
  noticeDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  historyBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  historyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  homeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  homeBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
