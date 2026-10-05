/**
 * Screen: CP-12 / CP-13 — Customer Transaction History Screen
 * Traceability: PondFish Customer Mobile App UI Specification (Sections 71, 72, 73, 74), Master PRD v2 (Section 18)
 * 
 * Lists completed customer physical purchases and counter settlements with item details,
 * subscription credit applied, and receipt views.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';

export default function TransactionHistoryScreen({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await api.getCustomerTransactions({ limit: 50 });
      if (res.success && Array.isArray(res.data)) {
        setTransactions(res.data);
      }
    } catch (err) {
      console.warn('[TRANSACTION HISTORY ERROR]', err);
      setErrorMessage(err.message || 'Unable to load transaction history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Transaction History</Text>
          <Text style={styles.headerSub}>Completed in-store purchases & settlements</Text>
        </View>
        <TouchableOpacity
          style={styles.scanActionBtn}
          onPress={() => onNavigate('SCAN_BILL')}
          activeOpacity={0.8}
        >
          <Text style={styles.scanActionText}>+ Scan Bill</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Unable to Load History</Text>
          <Text style={styles.errorDesc}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchTransactions}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyTitle}>No Transactions Yet</Text>
          <Text style={styles.emptyDesc}>
            Your completed physical store purchases and counter settlements will appear here.
          </Text>
          <TouchableOpacity
            style={styles.emptyScanBtn}
            onPress={() => onNavigate('SCAN_BILL')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyScanBtnText}>Scan Counter Bill</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
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
          {transactions.map((tx) => {
            const items = Array.isArray(tx.items) ? tx.items : [];
            const isSubOnly = tx.paymentMethod === 'SUBSCRIPTION_ONLY';
            const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }) : '';

            return (
              <View key={tx.id} style={styles.card}>
                {/* Card Top Row */}
                <View style={styles.cardTopRow}>
                  <View>
                    <Text style={styles.txNumber}>{tx.transactionNumber}</Text>
                    <Text style={styles.txDate}>{dateStr}</Text>
                  </View>
                  <View
                    style={[
                      styles.methodPill,
                      isSubOnly ? styles.methodPillSub : styles.methodPillRazorpay,
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodPillText,
                        isSubOnly ? styles.methodTextSub : styles.methodTextRazorpay,
                      ]}
                    >
                      {isSubOnly ? 'Subscription' : 'Razorpay'}
                    </Text>
                  </View>
                </View>

                {/* Bill ID Tag */}
                {Boolean(tx.billNumber) && (
                  <View style={styles.billTagRow}>
                    <Text style={styles.billTagLabel}>Bill ID:</Text>
                    <Text style={styles.billTagValue}>{tx.billNumber}</Text>
                  </View>
                )}

                <View style={styles.divider} />

                {/* Items Summary */}
                <View style={styles.itemsBox}>
                  {items.map((it, idx) => (
                    <View key={it.id || idx} style={styles.itemRow}>
                      <Text style={styles.itemName}>
                        • {it.fishName} ({it.quantityKg} kg)
                      </Text>
                      <Text style={styles.itemSubtotal}>₹{it.subtotal?.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.divider} />

                {/* Financial Summary */}
                <View style={styles.financeRow}>
                  <View>
                    {tx.subCreditUsed > 0 && (
                      <Text style={styles.creditText}>
                        Credit Applied: -₹{tx.subCreditUsed.toFixed(2)}
                      </Text>
                    )}
                    <Text style={styles.totalLabel}>
                      Total Bill: ₹{tx.totalBillAmount?.toFixed(2)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.paidLabel}>Paid Amount</Text>
                    <Text style={styles.paidAmount}>₹{tx.finalPaidAmount?.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButtonText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  scanActionBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scanActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  errorDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyScanBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyScanBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  txDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  methodPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  methodPillSub: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
  },
  methodPillRazorpay: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
  },
  methodPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  methodTextSub: {
    color: colors.freshGreen,
  },
  methodTextRazorpay: {
    color: colors.accent,
  },
  billTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  billTagLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 4,
  },
  billTagValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  itemsBox: {
    paddingVertical: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  itemName: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  financeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  creditText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.freshGreen,
    marginBottom: 2,
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  paidLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  paidAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.freshGreen,
  },
});
