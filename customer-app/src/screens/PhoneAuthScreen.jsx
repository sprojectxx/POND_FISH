/**
 * Screen: CP-01B / CP-01C — Customer Welcome & Phone Number Entry
 * Traceability: PondFish Customer Mobile App UI Specification (Sections 9 & 10)
 * Upgraded to match the modern, ultra-premium maritime UI design system.
 */

import React, { useState, useRef } from 'react';
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
  Image,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import { sendFirebasePhoneOtp } from '../services/firebase-auth';

export default function PhoneAuthScreen({ onNavigate }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isSubmittingRef = useRef(false);

  // Sanitize Indian mobile number (handles +91, 91, or leading 0 prefix gracefully)
  function sanitizeMobile(input) {
    if (typeof input !== 'string') return '';
    let digits = input.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    }
    return digits;
  }

  // Validate 10-digit Indian mobile format (starts with 6, 7, 8, 9)
  function validatePhone(number) {
    return /^[6-9]\d{9}$/.test(number);
  }

  async function handleSendOtp() {
    if (isSubmittingRef.current || loading) return;
    setErrorMessage('');

    const cleaned = sanitizeMobile(phone);

    if (!validatePhone(cleaned)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. 98765 43210).');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      // 1. Initiate backend validation & rate limit checks
      await api.sendOtp(cleaned);

      // 2. Initiate real Firebase Phone OTP dispatch
      await sendFirebasePhoneOtp(cleaned);

      // 3. Navigate to OTP Verification Screen
      onNavigate('OTP_VERIFY', { mobileNumber: cleaned });
    } catch (err) {
      console.error('[SEND OTP ERROR]', err?.message || err);
      const userMessage = err?.error?.message || err?.message || 'Failed to dispatch verification code. Please check your network and phone number.';
      setErrorMessage(userMessage);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* 1. Top Header & Branding Banner */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logoBadgeImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>
            POND<Text style={{ color: '#0284C7' }}>FISH</Text>
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Fresh lake catch transported daily to our Bangalore retail counter.
          </Text>
        </View>

        {/* 2. Three Value Highlights */}
        <View style={styles.valueRow}>
          <View style={styles.valueItem}>
            <View style={styles.checkCircleSmall}>
              <Text style={styles.checkIconSmall}>✓</Text>
            </View>
            <Text style={styles.valueText}>100% Chemical-Free</Text>
          </View>
          <View style={styles.valueItem}>
            <View style={styles.checkCircleSmall}>
              <Text style={styles.checkIconSmall}>✓</Text>
            </View>
            <Text style={styles.valueText}>0–24h Green Freshness</Text>
          </View>
          <View style={styles.valueItem}>
            <View style={styles.checkCircleSmall}>
              <Text style={styles.checkIconSmall}>✓</Text>
            </View>
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
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={14}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (errorMessage) setErrorMessage('');
              }}
              editable={!loading}
              accessibilityLabel="10-digit mobile number input"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Send Verification Code"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Send Verification Code →</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.termsNote}>
            By continuing, you agree to PondFish's freshness standards and terms of service. No passwords required.
          </Text>
        </View>

        {/* 4. Trust Footer */}
        <View style={styles.trustFooter}>
          <View style={styles.trustRow}>
            <Text style={styles.shieldIcon}>🛡</Text>
            <Text style={styles.trustTitle}>100% SECURE MARITIME AUTH</Text>
            <Text style={styles.zapIcon}>⚡</Text>
          </View>
          <Text style={styles.trustDescription}>
            Direct farm-gate harvests • Continuous cold chain • Bengaluru counter delivery
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  logoBadgeImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 18,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkCircleSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconSmall: {
    color: '#16A34A',
    fontSize: 9,
    fontWeight: '900',
  },
  valueText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 18,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  countryCodeBox: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderLeftWidth: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  submitButton: {
    backgroundColor: '#0A192F',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  termsNote: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 14,
  },
  trustFooter: {
    alignItems: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  shieldIcon: {
    fontSize: 12,
  },
  trustTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  zapIcon: {
    fontSize: 11,
  },
  trustDescription: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 14,
  },
});
