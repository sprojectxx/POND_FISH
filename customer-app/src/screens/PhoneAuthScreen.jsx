/**
 * Screen: CP-01B / CP-01C — Customer Welcome & Phone Number Entry
 * Traceability: PondFish Customer Mobile App UI Specification (Sections 9 & 10)
 * Upgraded to match the modern, ultra-premium maritime UI design system.
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
      console.error('[SEND OTP ERROR]', err?.message || err);
      setErrorMessage(err?.message || 'Failed to dispatch verification code. Please check your network and phone number.');
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
        {/* 1. Top Header & Branding Banner */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🐟</Text>
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
            activeOpacity={0.85}
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
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 32,
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
