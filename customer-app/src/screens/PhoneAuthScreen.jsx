/**
 * Screen: CP-01B / CP-01C — Customer Welcome & Phone Number Entry
 * Traceability: PondFish Customer Mobile App UI Specification (Sections 9 & 10)
 */

import React, { useState } from 'react';
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
import { sendFirebasePhoneOtp } from '../services/firebase-auth';

export default function PhoneAuthScreen({ onNavigate }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Validate 10-digit Indian mobile format
  function validatePhone(number) {
    const cleaned = number.replace(/\D/g, '');
    return /^[6-9]\d{9}$/.test(cleaned);
  }

  async function handleSendOtp() {
    setErrorMessage('');
    const cleaned = phone.replace(/\D/g, '').slice(-10);

    if (!validatePhone(cleaned)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      // 1. Initiate backend validation & rate limit checks
      await api.sendOtp(cleaned);

      // 2. Initiate Firebase Phone OTP dispatch
      await sendFirebasePhoneOtp(cleaned);

      // 3. Navigate to OTP Verification Screen
      onNavigate('OTP_VERIFY', { mobileNumber: cleaned });
    } catch (err) {
      console.error('[SEND OTP ERROR]', err);
      setErrorMessage(err.message || 'We couldn’t send the OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* 1. Header & Branding */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🐟</Text>
          </View>
          <Text style={styles.brandTitle}>
            POND<Text style={{ color: colors.accent }}>FISH</Text>
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Fresh lake catch transported daily to our Bangalore retail counter.
          </Text>
        </View>

        {/* 2. Three Value Highlights */}
        <View style={styles.valueRow}>
          <View style={styles.valueItem}>
            <Text style={styles.valueDot}>✓</Text>
            <Text style={styles.valueText}>100% Chemical-Free</Text>
          </View>
          <View style={styles.valueItem}>
            <Text style={styles.valueDot}>✓</Text>
            <Text style={styles.valueText}>0–24h Green Freshness</Text>
          </View>
          <View style={styles.valueItem}>
            <Text style={styles.valueDot}>✓</Text>
            <Text style={styles.valueText}>Live Truck GPS</Text>
          </View>
        </View>

        {/* 3. Phone Input Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in or Create Account</Text>
          <Text style={styles.cardSubtitle}>
            Enter your mobile number. We will send you a 6-digit verification code.
          </Text>

          {/* Error Banner */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Input Group */}
          <View style={styles.inputContainer}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="98765 43210"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={11}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (errorMessage) setErrorMessage('');
              }}
              editable={!loading}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Send Verification Code &rarr;</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.termsNote}>
            By continuing, you agree to PondFish's freshness standards and terms of service. No passwords required.
          </Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 32,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valueDot: {
    color: colors.freshGreen,
    fontWeight: '800',
    fontSize: 12,
  },
  valueText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  countryCodeBox: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 16,
    height: 52,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  termsNote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
