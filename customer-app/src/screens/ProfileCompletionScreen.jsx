/**
 * Screen: CP-01E — Profile Completion Screen
 * Traceability: PondFish Customer Mobile App UI Specification (Section 12)
 * Collects required Name, Age, and Area for newly registered customers.
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
import { colors } from '../theme/colors';
import { api } from '../services/api';

export default function ProfileCompletionScreen({ routeParams, onNavigate }) {
  const initialCustomer = routeParams?.customer || {};
  const token = routeParams?.token || '';

  const [customerData, setCustomerData] = useState(initialCustomer);
  const [name, setName] = useState(initialCustomer.name || '');
  const [age, setAge] = useState(initialCustomer.age ? String(initialCustomer.age) : '');
  const [area, setArea] = useState(initialCustomer.area || '');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // If customer mobile number is not in route params, fetch authoritative profile
  useEffect(() => {
    let active = true;
    async function loadCustomerProfile() {
      if (!customerData?.mobileNumber) {
        try {
          const res = await api.getProfile(token);
          if (active && res?.data) {
            setCustomerData(res.data);
            if (res.data.name && !name) setName(res.data.name);
            if (res.data.age && !age) setAge(String(res.data.age));
            if (res.data.area && !area) setArea(res.data.area);
          }
        } catch (e) {
          // If network error, retain current customerData
        }
      }
    }
    loadCustomerProfile();
    return () => {
      active = false;
    };
  }, [customerData?.mobileNumber, token, name, age, area]);

  async function handleSubmitProfile() {
    if (loading || isSubmittingRef.current) return;
    if (isMountedRef.current) setErrorMessage('');

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      if (isMountedRef.current) {
        setErrorMessage('Please enter your full name (minimum 2 characters).');
      }
      return;
    }

    const numAge = parseInt(age, 10);
    if (isNaN(numAge) || numAge < 18 || numAge > 120) {
      if (isMountedRef.current) {
        setErrorMessage('Please enter a valid age between 18 and 120.');
      }
      return;
    }

    const trimmedArea = area.trim();
    if (!trimmedArea || trimmedArea.length < 2) {
      if (isMountedRef.current) {
        setErrorMessage('Please enter your locality or delivery area in Bangalore.');
      }
      return;
    }

    isSubmittingRef.current = true;
    if (isMountedRef.current) setLoading(true);

    try {
      const response = await api.updateProfile(
        {
          name: trimmedName,
          age: numAge,
          area: trimmedArea,
        },
        token
      );

      if (!response || !response.success || !response.data) {
        throw new Error(response?.error?.message || response?.message || 'We couldn’t complete your profile. Please try again.');
      }

      const updatedCustomer = response.data;
      onNavigate('HOME', { customer: updatedCustomer, token });
    } catch (err) {
      console.error('[PROFILE COMPLETION ERROR]', err);
      if (isMountedRef.current) {
        setErrorMessage(err.message || 'We couldn’t complete your profile. Please try again.');
      }
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Step 2 of 2</Text>
          </View>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            We need a few quick details to personalize your daily fresh catch delivery and booking orders.
          </Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {/* Error Banner */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Verified Mobile (Read-Only) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Verified Mobile Number</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>
                {customerData.mobileNumber ? `🇮🇳 +91 ${customerData.mobileNumber}` : 'Loading verified mobile...'}
              </Text>
              <Text style={styles.verifiedTag}>✓ Verified</Text>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={(val) => {
                setName(val);
                if (errorMessage) setErrorMessage('');
              }}
              editable={!loading}
              accessibilityLabel="Full Name input"
              autoCapitalize="words"
            />
          </View>

          {/* Age */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Age *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 35"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={3}
              value={age}
              onChangeText={(val) => {
                setAge(val.replace(/\D/g, ''));
                if (errorMessage) setErrorMessage('');
              }}
              editable={!loading}
              accessibilityLabel="Age input"
            />
          </View>

          {/* Locality / Area */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bangalore Area / Locality *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Indiranagar, HSR Layout, Whitefield"
              placeholderTextColor={colors.textMuted}
              value={area}
              onChangeText={(val) => {
                setArea(val);
                if (errorMessage) setErrorMessage('');
              }}
              editable={!loading}
              accessibilityLabel="Bangalore Area or Locality input"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmitProfile}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Complete Profile and Enter PondFish"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Complete & Enter PondFish &rarr;</Text>
            )}
          </TouchableOpacity>


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
    marginBottom: 24,
  },
  badge: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    marginBottom: 12,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
  },
  errorBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorBannerText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  readOnlyInput: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readOnlyText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedTag: {
    color: colors.freshGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

});
