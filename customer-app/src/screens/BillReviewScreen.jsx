/**
 * Screen: CP-14, CP-15, CP-16, CP-17 — Extracted Bill Review & Payment Screen
 * Traceability: PondFish Customer Mobile App UI Specification (Sections 80, 81, 82, 83, 84, 85, 86)
 * 
 * Provides:
 * 1. AI Extraction review with confidence level badge
 * 2. Manual Bill ID fallback input when OCR does not identify the Bill Number
 * 3. Authoritative server calculation preview of subscription coverage & credit usage
 * 4. Transparent fee breakdown (2% Razorpay + 18% GST)
 * 5. Atomic physical transaction finalization with instant feedback
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import RazorpayCheckout from 'react-native-razorpay';

export default function BillReviewScreen({ routeParams = {}, onNavigate }) {
  const { scanId, initialScan, capturedImageUri } = routeParams;

  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [billNumber, setBillNumber] = useState(initialScan?.bill_number || '');
  const [billNumberMissing, setBillNumberMissing] = useState(initialScan?.bill_number_missing ?? !initialScan?.bill_number);
  const [editingBillNumber, setEditingBillNumber] = useState(false);
  const [manualInput, setManualInput] = useState(initialScan?.bill_number || '');
  const [savingBillNumber, setSavingBillNumber] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchPreview = useCallback(async (currentScanId) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await api.previewPhysicalTransaction(currentScanId, initialScan?.items || []);
      if (res.success && res.data) {
        setPreviewData(res.data);
        if (res.data.billNumber) {
          setBillNumber(res.data.billNumber);
          setBillNumberMissing(false);
          setManualInput(res.data.billNumber);
        }
      }
    } catch (err) {
      console.warn('[BILL REVIEW PREVIEW ERROR]', err);
      setErrorMessage(err.message || 'Unable to calculate subscription coverage for this bill.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (scanId) {
      fetchPreview(scanId);
    }
  }, [scanId, fetchPreview]);

  async function handleSaveManualBillNumber() {
    if (!manualInput || manualInput.trim().length === 0) {
      Alert.alert('Required', 'Please enter a valid Bill ID from your receipt.');
      return;
    }

    try {
      setSavingBillNumber(true);
      setErrorMessage(null);
      const res = await api.updateBillNumber(scanId, manualInput.trim());
      if (res.success) {
        setBillNumber(res.data.billNumber || manualInput.trim().toUpperCase());
        setBillNumberMissing(false);
        setEditingBillNumber(false);
        // Refresh preview with confirmed ID
        await fetchPreview(scanId);
      }
    } catch (err) {
      console.warn('[UPDATE BILL NUMBER ERROR]', err);
      setErrorMessage(err.message || 'Unable to save Bill ID. Please check the receipt.');
    } finally {
      setSavingBillNumber(false);
    }
  }

  async function handleFinalizeTransaction() {
    if (billNumberMissing || !billNumber) {
      Alert.alert('Bill ID Required', 'Please enter the Bill ID from your printed receipt before payment.');
      setEditingBillNumber(true);
      return;
    }

    try {
      setCommitting(true);
      setErrorMessage(null);

      // 1. Confirm bill state before commit
      await api.confirmBillScan(scanId);

      const finalPayable = previewData?.payment?.finalPayable || 0;
      const paymentRequired = finalPayable > 0;

      let razorpayPaymentId = null;
      let razorpayOrderId = null;
      let razorpaySignature = null;

      if (paymentRequired) {
        // Enforce genuine server-side Razorpay order creation
        const orderRes = await api.createRazorpayOrder({ billId: scanId, items: previewData?.items || [] });
        if (!orderRes.configured || !orderRes.success) {
          Alert.alert(
            'Payment Gateway Unavailable',
            orderRes.error?.message || orderRes.message || 'Genuine Razorpay credentials are required to complete online payment.'
          );
          setCommitting(false);
          return;
        }

        const orderData = orderRes.data || orderRes;
        const razorpayOptions = {
          description: `PondFish Bill #${scanId ? scanId.slice(0, 8) : 'Catch'}`,
          currency: orderData.currency || 'INR',
          key: orderData.keyId,
          amount: orderData.amount || Math.round(finalPayable * 100),
          name: 'PondFish',
          order_id: orderData.orderId,
          prefill: {
            email: 'customer@pondfish.in',
            contact: '9876543210',
            name: 'PondFish Customer',
          },
          theme: { color: colors.accent || '#007A78' },
        };

        let paymentData;
        try {
          paymentData = await RazorpayCheckout.open(razorpayOptions);
        } catch (payErr) {
          console.warn('[TRANSACTION COMMIT] Razorpay payment cancelled or failed:', payErr);
          const isCancelled = payErr?.code === 0 || payErr?.description?.toLowerCase()?.includes('cancel');
          Alert.alert(
            isCancelled ? 'Payment Cancelled' : 'Payment Failed',
            isCancelled
              ? 'Payment was cancelled. Your transaction has not been confirmed.'
              : (payErr?.description || 'Payment could not be completed. Please try again.')
          );
          setCommitting(false);
          return;
        }

        razorpayPaymentId = paymentData?.razorpay_payment_id;
        razorpayOrderId = paymentData?.razorpay_order_id || orderData.orderId;
        razorpaySignature = paymentData?.razorpay_signature;
      }

      // 2. Commit transaction atomically
      const res = await api.commitPhysicalTransaction({
        scanId,
        paymentMethod: paymentRequired ? 'RAZORPAY' : 'SUBSCRIPTION_ONLY',
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
        items: previewData?.items || [],
      });

      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Transaction finalization failed.');
      }

      // Navigate to Transaction Result Screen
      onNavigate('TRANSACTION_RESULT', {
        transaction: res.data,
      });
    } catch (err) {
      console.warn('[TRANSACTION COMMIT ERROR]', err);
      setErrorMessage(err.message || 'Payment could not be completed. Please review your bill.');
    } finally {
      setCommitting(false);
    }
  }

  const subCoverage = previewData?.subscriptionCoverage || {};
  const payment = previewData?.payment || {};
  const items = previewData?.items || initialScan?.items || [];
  const finalPayable = payment.finalPayable !== undefined ? payment.finalPayable : previewData?.totalBillAmount || initialScan?.total || 0;
  const rawConfidence = initialScan?.confidence_score ?? previewData?.confidenceScore ?? 0.85;
  const confidencePercent = Math.round(rawConfidence * 100);
  const isLowConfidence = confidencePercent < 70;
  const warnings = [
    ...(initialScan?.warnings || []),
    ...(previewData?.warnings || []),
  ].filter((w, i, arr) => arr.indexOf(w) === i);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('SCAN_BILL')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Review Extracted Bill</Text>
          <Text style={styles.headerSub}>Verify cuts, weights & subscription benefits</Text>
        </View>
        <View style={[styles.aiBadge, isLowConfidence && styles.aiBadgeWarning]}>
          <Text style={[styles.aiBadgeText, isLowConfidence && styles.aiBadgeTextWarning]}>
            {confidencePercent}% AI OCR
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Calculating subscription coverage...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.errorTitle}>Action Required</Text>
                <Text style={styles.errorDesc}>{errorMessage}</Text>
              </View>
            </View>
          )}

          {/* Extraction Warnings & Uncertain Fields Banner */}
          {warnings.length > 0 && (
            <View style={styles.warningAlertCard}>
              <Text style={styles.warningAlertTitle}>⚠️ Please Verify Extracted Information</Text>
              {warnings.map((w, idx) => (
                <Text key={idx} style={styles.warningAlertText}>• {w}</Text>
              ))}
            </View>
          )}

          {/* Original Receipt Image Card (CP-15 Spec) */}
          {(capturedImageUri || initialScan?.image_url) && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Original Store Receipt</Text>
                  <Text style={styles.receiptHintText}>Verify paper bill against AI extraction</Text>
                </View>
                <View style={styles.imageVerifiedPill}>
                  <Text style={styles.imageVerifiedPillText}>📷 Captured Image</Text>
                </View>
              </View>
              <View style={styles.receiptImageContainer}>
                <Image
                  source={{ uri: capturedImageUri || initialScan?.image_url }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}

          {/* Advisory Notice */}
          <View style={styles.advisoryNoteCard}>
            <Text style={styles.advisoryNoteText}>
              ℹ️ AI extraction is advisory. Please confirm that the Bill ID, fish cuts, weights, and prices match your printed counter receipt before proceeding.
            </Text>
          </View>

          {/* 1. Bill ID Status Section */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Bill Identifier</Text>
              {!billNumberMissing && !editingBillNumber && (
                <TouchableOpacity onPress={() => setEditingBillNumber(true)}>
                  <Text style={styles.editActionText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {billNumberMissing || editingBillNumber ? (
              <View style={styles.manualBillBox}>
                <Text style={styles.manualNoticeText}>
                  {billNumberMissing
                    ? '⚠️ Bill ID could not be detected automatically. Please enter it from your paper receipt.'
                    : 'Update Bill ID if extracted incorrectly:'}
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={manualInput}
                    onChangeText={setManualInput}
                    placeholder="e.g. BILL-1042"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.saveButton, savingBillNumber && styles.saveButtonDisabled]}
                    onPress={handleSaveManualBillNumber}
                    disabled={savingBillNumber}
                    activeOpacity={0.8}
                  >
                    {savingBillNumber ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Verify</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.verifiedBillBox}>
                <View style={styles.billBadge}>
                  <Text style={styles.billBadgeIcon}>✓</Text>
                  <Text style={styles.billNumberText}>{billNumber}</Text>
                </View>
                <Text style={styles.verifiedTag}>Verified Counter Bill</Text>
              </View>
            )}
          </View>

          {/* 2. Extracted Line Items */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Fish Cuts & Weights</Text>
              <Text style={styles.itemCountTag}>{items.length} cut{items.length === 1 ? '' : 's'} detected</Text>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Text style={styles.emptyItemsText}>⚠️ No fish cuts recognized from receipt text</Text>
                <Text style={styles.emptyItemsSub}>You can retake the photo with better lighting or scan another bill.</Text>
              </View>
            ) : (
              items.map((item, index) => (
                <View key={item.fishId || index} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{item.fishName || 'Fresh Fish Cut'}</Text>
                    <Text style={styles.itemSub}>
                      {item.quantityKg} kg • ₹{item.unitPrice}/kg
                    </Text>
                    {item.confidence !== undefined && item.confidence < 0.8 && (
                      <View style={styles.uncertainBadge}>
                        <Text style={styles.uncertainBadgeText}>⚠️ Uncertain Cut Match</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.itemPrice}>₹{item.subtotal?.toFixed(2)}</Text>
                </View>
              ))
            )}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Bill Amount</Text>
              <Text style={styles.summaryValue}>
                ₹{(previewData?.totalBillAmount !== undefined ? previewData.totalBillAmount : initialScan?.total || 0).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* 3. Subscription Coverage Breakdown (CP-09 / CP-15) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Subscription Benefits</Text>
              {subCoverage.hasActiveSubscription ? (
                <View style={styles.planActivePill}>
                  <Text style={styles.planActiveText}>{subCoverage.planTitle || 'Active Plan'}</Text>
                </View>
              ) : (
                <View style={styles.noSubPill}>
                  <Text style={styles.noSubText}>No Plan</Text>
                </View>
              )}
            </View>

            {subCoverage.hasActiveSubscription ? (
              <View>
                <View style={styles.benefitRow}>
                  <Text style={styles.benefitLabel}>Subscription-covered</Text>
                  <Text style={styles.benefitValueGreen}>{subCoverage.coveredQuantityKg} kg</Text>
                </View>

                <View style={styles.benefitRow}>
                  <Text style={styles.benefitLabel}>Subscription Credit Applied</Text>
                  <Text style={styles.benefitValueGreen}>-₹{subCoverage.subCreditUsed?.toFixed(2)}</Text>
                </View>

                <View style={styles.benefitRow}>
                  <Text style={styles.benefitLabel}>Remaining Credit Balance</Text>
                  <Text style={styles.benefitValueMuted}>₹{subCoverage.remainingCreditBalance?.toFixed(2)}</Text>
                </View>

                <View style={styles.benefitRow}>
                  <Text style={styles.benefitLabel}>Weekly Allowance Remaining</Text>
                  <Text style={styles.benefitValueMuted}>{subCoverage.remainingWeeklyKg} kg</Text>
                </View>

                <Text style={styles.coverageNote}>{subCoverage.statusText}</Text>
              </View>
            ) : (
              <View style={styles.noSubContent}>
                <Text style={styles.noSubDesc}>
                  You don't have an active subscription plan. Full amount is payable via online gateway.
                </Text>
                <TouchableOpacity
                  style={styles.viewPlansBtn}
                  onPress={() => onNavigate('SUBSCRIPTION')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewPlansText}>View Subscription Plans →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 4. Payment Breakdown Card (CP-10 / CP-17) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Breakdown</Text>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Remaining Fish Amount</Text>
              <Text style={styles.breakdownValue}>₹{payment.extraAmountPayable?.toFixed(2) || '0.00'}</Text>
            </View>

            {payment.finalPayable > 0 && (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Razorpay Gateway Fee (2%)</Text>
                  <Text style={styles.breakdownValue}>₹{payment.gatewayFee?.toFixed(2) || '0.00'}</Text>
                </View>

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>GST on Fee (18%)</Text>
                  <Text style={styles.breakdownValue}>₹{payment.feeGst?.toFixed(2) || '0.00'}</Text>
                </View>
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.finalRow}>
              <View>
                <Text style={styles.finalLabel}>Final Amount Payable</Text>
                <Text style={styles.finalSub}>
                  {finalPayable === 0 ? 'Fully covered by subscription' : 'Payable via Razorpay'}
                </Text>
              </View>
              <Text style={styles.finalAmount}>₹{finalPayable.toFixed(2)}</Text>
            </View>
          </View>

          {/* 5. Primary Actions */}
          <TouchableOpacity
            style={[styles.primaryActionBtn, committing && styles.primaryActionBtnDisabled]}
            onPress={handleFinalizeTransaction}
            disabled={committing}
            activeOpacity={0.8}
          >
            {committing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryActionText}>
                {finalPayable === 0 ? '✓ Complete with Subscription' : `Pay ₹${finalPayable.toFixed(2)}`}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={() => onNavigate('SCAN_BILL')}
            disabled={committing}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryActionText}>Scan Another Bill</Text>
          </TouchableOpacity>
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
  aiBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiBadgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  aiBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  aiBadgeTextWarning: {
    color: '#D97706',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  errorDesc: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptHintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  imageVerifiedPill: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  imageVerifiedPillText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
  },
  receiptImageContainer: {
    height: 200,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  warningAlertCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  warningAlertTitle: {
    color: '#D97706',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  warningAlertText: {
    color: '#B45309',
    fontSize: 12,
    lineHeight: 18,
  },
  advisoryNoteCard: {
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  advisoryNoteText: {
    color: colors.accent,
    fontSize: 12,
    lineHeight: 17,
  },
  itemCountTag: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptyItemsBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyItemsText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyItemsSub: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  uncertainBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  uncertainBadgeText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  editActionText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  manualBillBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  manualNoticeText: {
    color: '#F59E0B',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.bgMain,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  verifiedBillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  billBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMain,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  billBadgeIcon: {
    color: colors.freshGreen,
    fontSize: 14,
    fontWeight: '900',
    marginRight: 6,
  },
  billNumberText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  verifiedTag: {
    color: colors.freshGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  planActivePill: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  planActiveText: {
    color: colors.freshGreen,
    fontSize: 11,
    fontWeight: '800',
  },
  noSubPill: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  noSubText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  benefitLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  benefitValueGreen: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.freshGreen,
  },
  benefitValueMuted: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  coverageNote: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 8,
    fontStyle: 'italic',
  },
  noSubContent: {
    marginTop: 4,
  },
  noSubDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  viewPlansBtn: {
    marginTop: 8,
  },
  viewPlansText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  finalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  finalSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  finalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.freshGreen,
  },
  primaryActionBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryActionBtnDisabled: {
    opacity: 0.6,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginTop: 10,
  },
  secondaryActionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
