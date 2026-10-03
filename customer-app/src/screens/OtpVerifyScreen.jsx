/**
 * Screen: CP-01D — OTP Verification Screen
 * Traceability: PondFish Customer Mobile App UI Specification (Section 11)
 * Handles Firebase Phone OTP confirmation, hardware-backed Keystore persistence, and routing.
 */

import React, { useState, useEffect } from 'react';
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
import { colors } from '../theme/colors';
import { api } from '../services/api';
import { saveAuthTokens } from '../services/auth-storage';
import { verifyFirebasePhoneOtp, sendFirebasePhoneOtp } from '../services/firebase-auth';

const COUNTDOWN_SECONDS = 30;

export default function OtpVerifyScreen({ routeParams, onNavigate }) {
  const mobileNumber = routeParams?.mobileNumber || '';
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  // Countdown timer for Resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Mask phone number (e.g. +91 98765 •••••)
  const maskedPhone = mobileNumber.length >= 10
    ? `+91 ${mobileNumber.slice(0, 5)} •••••`
    : `+91 ${mobileNumber}`;

  async function handleVerifyOtp() {
    setErrorMessage('');
    const cleanOtp = otp.trim();

    if (cleanOtp.length < 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      // 1. Confirm OTP with Firebase Auth service
      const { idToken } = await verifyFirebasePhoneOtp(cleanOtp);

      // 2. Call PondFish backend to verify identity, retrieve/create customer record, and issue session
      const response = await api.verifyOtp({
        mobileNumber,
        idToken,
        otp: cleanOtp,
      });

      const { token, customer, isProfileComplete } = response.data;

      // 3. Persist session token securely into Android Keystore (Zero AsyncStorage for auth)
      await saveAuthTokens(token);

      // 4. Navigate based on profile completeness state machine
      if (isProfileComplete) {
        onNavigate('HOME', { customer, token });
      } else {
        onNavigate('PROFILE_COMPLETION', { customer, token });
      }
    } catch (err) {
      console.error('[OTP VERIFY ERROR]', err);
      setErrorMessage(err.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (countdown > 0 || resending) return;
    setResending(true);
    setErrorMessage('');

    try {
      await api.sendOtp(mobileNumber);
      await sendFirebasePhoneOtp(mobileNumber);
      setCountdown(COUNTDOWN_SECONDS);
      setOtp('');
    } catch (err) {
      console.error('[RESEND OTP ERROR]', err);
      setErrorMessage('Unable to resend OTP. Please wait and try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Back / Change Number Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('PHONE_AUTH')}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>&larr; Change Mobile Number</Text>
        </TouchableOpacity>

        {/* Verification Card */}
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>📲</Text>
          </View>

          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            A 6-digit code has been dispatched via SMS to:
          </Text>
          <Text style={styles.phoneHighlight}>{maskedPhone}</Text>

          {/* Error Message Banner */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* OTP Digit Input */}
          <View style={styles.otpInputContainer}>
            <TextInput
              style={styles.otpInput}
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(val) => {
                setOtp(val.replace(/\D/g, ''));
                if (errorMessage) setErrorMessage('');
              }}
              editable={!loading}
              autoFocus
            />
          </View>

          {/* Verify CTA Button */}
          <TouchableOpacity
            style={[styles.verifyButton, (loading || otp.length < 6) && styles.verifyButtonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading || otp.length < 6}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Continue &rarr;</Text>
            )}
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={styles.resendContainer}>
            {countdown > 0 ? (
              <Text style={styles.countdownText}>
                Resend code in <Text style={{ color: colors.accent, fontWeight: '700' }}>{countdown}s</Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResendCode}
                disabled={resending}
                style={styles.resendButton}
              >
                {resending ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={styles.resendButtonText}>Didn't receive code? Resend SMS</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  phoneHighlight: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  errorBannerText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  otpInputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  otpInput: {
    backgroundColor: colors.bgInput,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    height: 58,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 10,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  resendContainer: {
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  resendButton: {
    padding: 6,
  },
  resendButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
