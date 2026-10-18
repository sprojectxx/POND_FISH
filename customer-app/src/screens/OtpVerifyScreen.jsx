/**
 * Screen: CP-01D — OTP Verification Screen
 * Traceability: Exact match to PondFish design specification
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { api } from '../services/api';
import { saveAuthTokens } from '../services/auth-storage';
import { verifyFirebasePhoneOtp, sendFirebasePhoneOtp } from '../services/firebase-auth';

const COUNTDOWN_SECONDS = 30;

export default function OtpVerifyScreen({ routeParams = {}, onNavigate }) {
  const mobileNumber = routeParams?.mobileNumber || '';
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const inputRef = useRef(null);
  const isVerifyingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // If mobile number is not provided, return to phone entry
  useEffect(() => {
    if (!mobileNumber) {
      onNavigate('PHONE_AUTH');
    }
  }, [mobileNumber, onNavigate]);

  // Blinking cursor effect for active OTP box
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for Resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Mask phone number: e.g. +91 98765 •••••
  const maskedPhone = mobileNumber.length >= 10
    ? `+91 ${mobileNumber.slice(0, 5)} •••••`
    : `+91 ${mobileNumber}`;

  async function handleVerifyOtp(codeToVerify) {
    if (loading || isVerifyingRef.current) return; // Prevent duplicate/concurrent requests
    const cleanOtp = (codeToVerify || otp).trim();
    if (isMountedRef.current) setErrorMessage('');

    if (cleanOtp.length < 6) {
      if (isMountedRef.current) {
        setErrorMessage('Please enter the 6-digit verification code.');
      }
      return;
    }

    isVerifyingRef.current = true;
    if (isMountedRef.current) setLoading(true);

    try {
      // 1. Confirm OTP with Firebase to obtain genuine Firebase ID token
      const fbResult = await verifyFirebasePhoneOtp(cleanOtp);
      const idToken = fbResult?.idToken;

      if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
        throw new Error('Failed to retrieve Firebase verification token. Please request a new code.');
      }

      // 2. Authenticate with backend using genuine Firebase ID token
      const response = await api.verifyOtp({
        mobileNumber,
        idToken: idToken.trim(),
      });

      if (!response || !response.success || !response.data) {
        throw new Error(response?.error?.message || 'Authentication verification failed. Please try again.');
      }

      const { token, customer, isProfileComplete } = response.data;

      if (!token || typeof token !== 'string' || !token.trim()) {
        throw new Error('Invalid authentication session received from server.');
      }

      if (!customer || typeof customer !== 'object') {
        throw new Error('Invalid customer profile payload received from server.');
      }

      // 3. Persist genuine backend JWT in secure Android Keystore before navigating
      try {
        await saveAuthTokens(token);
      } catch (storageErr) {
        console.error('[AUTH STORAGE ERROR]', storageErr);
        throw new Error('Failed to securely store authentication session on device. Please try again.');
      }

      // 4. Navigate only after successful persistence
      const authoritativeCustomer = {
        ...customer,
        isProfileComplete: Boolean(isProfileComplete),
      };

      if (isProfileComplete) {
        onNavigate('HOME', { customer: authoritativeCustomer, token });
      } else {
        onNavigate('PROFILE_COMPLETION', { customer: authoritativeCustomer, token });
      }
    } catch (err) {
      console.error('[OTP VERIFY ERROR]', err?.message || err);
      if (isMountedRef.current) {
        let displayError = err?.message || 'Verification failed. Please check the code and try again.';
        const lower = displayError.toLowerCase();
        if (lower.includes('invalid') || lower.includes('incorrect') || lower.includes('mismatch')) {
          displayError = 'The OTP is incorrect. Please try again.';
        } else if (lower.includes('expired')) {
          displayError = 'This OTP has expired. Request a new OTP.';
        } else if (lower.includes('too many') || lower.includes('quota') || lower.includes('limit')) {
          displayError = 'Too many attempts. Please wait and try again.';
        }
        setErrorMessage(displayError);
      }
    } finally {
      isVerifyingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  async function handleResendCode() {
    if (countdown > 0 || resending || loading) return;
    setResending(true);
    if (isMountedRef.current) setErrorMessage('');

    try {
      await api.sendOtp(mobileNumber);
      await sendFirebasePhoneOtp(mobileNumber);
      if (isMountedRef.current) {
        setCountdown(COUNTDOWN_SECONDS);
        setOtp('');
      }
    } catch (err) {
      console.error('[RESEND OTP ERROR]', err?.message || err);
      if (isMountedRef.current) {
        setErrorMessage(err?.message || 'Failed to resend verification code. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setResending(false);
      }
    }
  }

  const activeIndex = Math.min(otp.length, 5);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Top Bar: ← PondFish */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backTouch}
            onPress={() => onNavigate('PHONE_AUTH')}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.topBackArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.brandTitle}>PondFish</Text>
        </View>

        {/* 2. Sub-Header: ← Change Mobile Number */}
        <TouchableOpacity
          style={styles.changeMobileTouch}
          onPress={() => onNavigate('PHONE_AUTH')}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.changeMobileText}>← Change Mobile Number</Text>
        </TouchableOpacity>

        {/* 3. Center Icon Illustration (Soft rounded square with inner device frame) */}
        <View style={styles.iconWrapper}>
          <View style={styles.iconOuterBox}>
            <View style={styles.iconInnerFrame} />
          </View>
        </View>

        {/* 4. Main Heading & Subtitle */}
        <Text style={styles.mainTitle}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>
          A 6-digit code has been dispatched via SMS to:
        </Text>

        {/* 5. Mobile Number Pill (+91 98765 ••••• ✎) */}
        <TouchableOpacity
          style={styles.phonePill}
          onPress={() => onNavigate('PHONE_AUTH')}
          activeOpacity={0.8}
        >
          <Text style={styles.phonePillIcon}>📱</Text>
          <Text style={styles.phonePillNumber}>{maskedPhone}</Text>
          <Text style={styles.phonePillEdit}>✎</Text>
        </TouchableOpacity>

        {/* Optional Error Banner */}
        {Boolean(errorMessage) && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* 6. Main Verification Card */}
        <View style={styles.cardContainer}>
          {/* Card Header: SMS SECURITY PIN & Auto-detected */}
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderLabel}>SMS SECURITY PIN</Text>
            <View style={styles.autoDetectRow}>
              <Text style={styles.shieldIcon}>🛡</Text>
              <Text style={styles.autoDetectText}>Auto-detected</Text>
            </View>
          </View>

          {/* Hidden text input for handling physical/virtual keyboard */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={(val) => {
              const cleaned = val.replace(/\D/g, '');
              setOtp(cleaned);
              if (errorMessage) setErrorMessage('');
              if (cleaned.length === 6) {
                handleVerifyOtp(cleaned);
              }
            }}
            editable={!loading}
            autoFocus
          />

          {/* 6 Digit Input Boxes */}
          <TouchableOpacity
            style={styles.digitsRow}
            onPress={() => inputRef.current?.focus()}
            activeOpacity={0.9}
          >
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const digit = otp[idx] || '';
              const isFilled = digit.length > 0;
              const isActive = idx === activeIndex && otp.length < 6;

              return (
                <View
                  key={idx}
                  style={[
                    styles.digitBox,
                    isFilled && styles.digitBoxFilled,
                    isActive && styles.digitBoxActive,
                  ]}
                >
                  {isFilled ? (
                    <Text style={styles.digitText}>{digit}</Text>
                  ) : isActive ? (
                    <Text style={[styles.cursorText, { opacity: cursorVisible ? 1 : 0 }]}>
                      |
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </TouchableOpacity>

          {/* Auto-reading SMS Banner */}
          <View style={styles.carrierReadingRow}>
            <View style={styles.readingLeft}>
              <View style={styles.carrierDot} />
              <Text style={styles.carrierText}>
                Auto-reading SMS code from carrier...
              </Text>
            </View>
            <Text style={styles.chatBubbleIcon}>💬</Text>
          </View>

          {/* Verify & Continue CTA Button */}
          <TouchableOpacity
            style={[
              styles.verifyBtn,
              loading && styles.verifyBtnDisabled,
            ]}
            onPress={() => handleVerifyOtp()}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.verifyBtnText}>Verify & Continue</Text>
                <View style={styles.btnRightRow}>
                  <View style={styles.fastPassBadge}>
                    <Text style={styles.fastPassText}>FAST PASS</Text>
                  </View>
                  <Text style={styles.arrowIcon}>→</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Resend SMS Timer */}
          <View style={styles.resendRow}>
            <Text style={styles.clockIcon}>⏱</Text>
            {countdown > 0 ? (
              <Text style={styles.resendText}>
                Resend SMS in{' '}
                <Text style={styles.resendTimerDigits}>
                  00:{countdown < 10 ? `0${countdown}` : countdown}
                </Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResendCode}
                disabled={resending || loading}
                accessibilityRole="button"
                accessibilityLabel="Resend SMS Code"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#1D61B4" />
                ) : (
                  <Text style={styles.resendActiveText}>Resend SMS Code</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 7. Bottom Security Footer */}
        <View style={styles.footerContainer}>
          <View style={styles.footerSecurityRow}>
            <Text style={styles.footerSecurityText}>100% SECURE MARITIME AUTH</Text>
            <Text style={styles.footerZapIcon}>⚡</Text>
          </View>
          <Text style={styles.footerSubtext}>Zero password friction</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFE',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 14 : 20,
    paddingBottom: 36,
  },

  // 1. Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backTouch: {
    paddingVertical: 4,
    paddingRight: 14,
  },
  topBackArrow: {
    fontSize: 26,
    color: '#0A1C33',
    fontWeight: '700',
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0A1C33',
    letterSpacing: -0.4,
  },

  // 2. Sub-Header: Change Mobile Number
  changeMobileTouch: {
    alignSelf: 'flex-start',
    marginBottom: 26,
  },
  changeMobileText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D61B4',
  },

  // 3. Center Icon Illustration
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconOuterBox: {
    width: 104,
    height: 104,
    borderRadius: 26,
    backgroundColor: '#EDF5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInnerFrame: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#C6DEF9',
    backgroundColor: '#F6FAFE',
  },

  // 4. Main Title & Subtitle
  mainTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#0B1E36',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },

  // 5. Phone Number Pill
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#EDF5FD',
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 18,
    marginBottom: 24,
  },
  phonePillIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  phonePillNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B1E36',
    marginRight: 8,
  },
  phonePillEdit: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D61B4',
  },

  // Error Banner
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },

  // 6. Card Container
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
  },
  autoDetectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  autoDetectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  // Hidden Input
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  // OTP 6 Digits Row
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  digitBox: {
    width: 44,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBoxFilled: {
    backgroundColor: '#EDF5FD',
    borderColor: '#EDF5FD',
    borderWidth: 0,
  },
  digitBoxActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  digitText: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0B1E36',
  },
  cursorText: {
    fontSize: 24,
    fontWeight: '400',
    color: '#1D61B4',
  },

  // Carrier Reading Banner
  carrierReadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EDF5FD',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  readingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  carrierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1D61B4',
    marginRight: 8,
  },
  carrierText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  chatBubbleIcon: {
    fontSize: 14,
  },

  // Primary Action Button
  verifyBtn: {
    backgroundColor: '#0C2340',
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  verifyBtnDisabled: {
    opacity: 0.85,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  btnRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fastPassBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  fastPassText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  arrowIcon: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },

  // Resend Timer Row
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  clockIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  resendText: {
    fontSize: 13,
    color: '#475569',
  },
  resendTimerDigits: {
    fontWeight: '800',
    color: '#0B1E36',
  },
  resendActiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D61B4',
  },

  // 7. Bottom Security Footer
  footerContainer: {
    marginTop: 38,
    alignItems: 'center',
  },
  footerSecurityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerSecurityText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B1E36',
    letterSpacing: 0.8,
  },
  footerZapIcon: {
    fontSize: 13,
    marginLeft: 4,
    color: '#1D61B4',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
