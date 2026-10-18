/**
 * Screen: CP-20 / CP-20A — Customer Profile & Account Services
 * Traceability: PondFish Customer Mobile App UI Specification (Sections 98-100) & API Specification (Section 11)
 * Displays verified customer identity, subscription status, edit capabilities, account shortcuts, and secure logout.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import { clearAuthTokens } from '../services/auth-storage';

export default function ProfileScreen({ routeParams = {}, onNavigate, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Genuine customer identity state
  const [profile, setProfile] = useState(routeParams?.customer || null);

  // Genuine subscription state
  const [subscriptionState, setSubscriptionState] = useState(null);

  // Edit Profile Modal state
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  // Load genuine profile and subscription data
  const loadProfileData = useCallback(async () => {
    try {
      setError(null);
      const [profileRes, subRes] = await Promise.all([
        api.getProfile().catch((err) => {
          console.warn('[PROFILE FETCH WARNING]', err.message);
          return null;
        }),
        api.getSubscription().catch((err) => {
          console.warn('[SUBSCRIPTION STATUS WARNING]', err.message);
          return null;
        }),
      ]);

      if (profileRes && profileRes.success && profileRes.data) {
        setProfile(profileRes.data);
      } else if (!profileRes) {
        // Fallback to routeParams if available, otherwise show retryable error
        setProfile((prev) => {
          if (prev) return prev;
          if (routeParams?.customer) return routeParams.customer;
          setError('Unable to load your profile. Please check your network connection.');
          return null;
        });
      }

      if (subRes && subRes.success && subRes.data) {
        setSubscriptionState(subRes.data);
      }
    } catch (err) {
      console.error('[PROFILE LOAD ERROR]', err);
      setError(err.message || 'Unable to load profile information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeParams]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfileData();
  }, [loadProfileData]);

  // Open Edit Modal with current values
  function handleOpenEdit() {
    setEditName(profile?.name || '');
    setEditAge(profile?.age ? String(profile?.age) : '');
    setEditArea(profile?.area || '');
    setEditError('');
    setIsEditModalVisible(true);
  }

  // Validate and submit profile update
  async function handleSaveProfile() {
    setEditError('');

    const trimmedName = editName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setEditError('Please enter your full name (minimum 2 characters).');
      return;
    }

    const numAge = parseInt(editAge, 10);
    if (isNaN(numAge) || numAge < 18 || numAge > 120) {
      setEditError('Please enter a valid age between 18 and 120.');
      return;
    }

    const trimmedArea = editArea.trim();
    if (!trimmedArea || trimmedArea.length < 2) {
      setEditError('Please enter your locality or delivery area in Bangalore.');
      return;
    }

    setEditLoading(true);
    try {
      const response = await api.updateProfile({
        name: trimmedName,
        age: numAge,
        area: trimmedArea,
      });

      if (!response || !response.success || !response.data) {
        throw new Error(response?.message || 'Unable to save your profile.');
      }

      // Authoritative merge preserving registration createdAt
      const updatedCustomer = {
        ...profile,
        ...response.data,
      };

      setProfile(updatedCustomer);
      setIsEditModalVisible(false);
      setEditSuccessMsg('Profile updated successfully.');
      setTimeout(() => setEditSuccessMsg(''), 4000);
    } catch (err) {
      console.error('[PROFILE SAVE ERROR]', err);
      setEditError(err.message || 'Unable to save your profile. Please try again.');
    } finally {
      setEditLoading(false);
    }
  }

  // Handle Logout Confirmation Dialog
  function handleLogoutPress() {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of PondFish? Your secure session will be cleared from this device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ],
      { cancelable: true }
    );
  }

  async function performLogout() {
    try {
      // 1. Clear credentials from Android Keystore
      await clearAuthTokens();

      // 2. Clear push device token if supported implementation available
      try {
        if (typeof api.unregisterDeviceToken === 'function') {
          // Unregister any active token silently
          await api.unregisterDeviceToken('').catch(() => {});
        }
      } catch (_) {}

      // 3. Inform parent shell to reset state and navigate to PHONE_AUTH
      if (typeof onLogout === 'function') {
        onLogout();
      } else if (typeof onNavigate === 'function') {
        onNavigate('PHONE_AUTH');
      }
    } catch (err) {
      console.error('[LOGOUT ERROR]', err);
      // Fallback navigation even if Keystore threw an exception
      if (typeof onLogout === 'function') {
        onLogout();
      } else if (typeof onNavigate === 'function') {
        onNavigate('PHONE_AUTH');
      }
    }
  }

  // Format date helper
  function formatMemberSince(isoDate) {
    if (!isoDate) return 'Member';
    try {
      const d = new Date(isoDate);
      return `Member since ${d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
    } catch {
      return 'Member';
    }
  }

  // Format phone helper
  function formatMobile(num) {
    if (!num) return 'Not available';
    const clean = String(num).replace(/^\+?91/, '').trim();
    if (clean.length === 10) {
      return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
    }
    return `+91 ${clean}`;
  }

  // Get Initials for Avatar
  const customerName = profile?.name || 'Customer';
  const avatarInitials = customerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'PF';

  const hasSub = Boolean(subscriptionState?.hasSubscription && subscriptionState?.subscription);
  const subDetails = subscriptionState?.subscription;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* Screen App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>My Profile</Text>
          <Text style={styles.appBarSubtitle}>Customer Identity & Account Services</Text>
        </View>
        <TouchableOpacity
          style={styles.editHeaderBtn}
          onPress={handleOpenEdit}
          activeOpacity={0.8}
        >
          <Text style={styles.editHeaderBtnText}>Edit ✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Body Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading profile details...</Text>
        </View>
      ) : error && !profile ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadProfileData}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
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
          {/* Success Banner */}
          {Boolean(editSuccessMsg) && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>✓ {editSuccessMsg}</Text>
            </View>
          )}

          {/* Customer Identity Card */}
          <View style={styles.identityCard}>
            <View style={styles.identityTopRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{avatarInitials}</Text>
              </View>
              <View style={styles.identityDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.customerNameText} numberOfLines={1}>
                    {profile?.name || 'Customer Name'}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
                  </View>
                </View>
                <Text style={styles.memberSinceText}>
                  {formatMemberSince(profile?.createdAt)}
                </Text>
                {Boolean(profile?.id) && (
                  <Text style={styles.customerIdText}>
                    ID: {profile.id.substring(0, 12)}...
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.identityDivider} />

            {/* Profile Field Rows */}
            <View style={styles.fieldGrid}>
              {/* Verified Mobile Number (Protected) */}
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
                <View style={styles.fieldValRow}>
                  <Text style={styles.fieldValText}>
                    {formatMobile(profile?.mobileNumber)}
                  </Text>
                  <Text style={styles.lockIcon}>🔒</Text>
                </View>
                <Text style={styles.fieldSubnote}>Verified with Firebase OTP</Text>
              </View>

              {/* Delivery Area / Locality */}
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>DELIVERY AREA / LOCALITY</Text>
                <View style={styles.fieldValRow}>
                  <Text style={styles.fieldValText}>
                    {profile?.area || 'Not added'}
                  </Text>
                </View>
                <Text style={styles.fieldSubnote}>Bangalore fresh catch route</Text>
              </View>

              {/* Customer Age */}
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>AGE</Text>
                <View style={styles.fieldValRow}>
                  <Text style={styles.fieldValText}>
                    {profile?.age ? `${profile.age} years` : 'Not added'}
                  </Text>
                </View>
                <Text style={styles.fieldSubnote}>Eligible adult member</Text>
              </View>
            </View>
          </View>

          {/* Genuine Subscription Summary Card */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>MEMBERSHIP & SUBSCRIPTION</Text>
          </View>
          <View style={styles.subscriptionCard}>
            {hasSub ? (
              <View>
                <View style={styles.subCardTop}>
                  <View style={styles.subPlanInfo}>
                    <Text style={styles.subPlanTitle}>
                      {subDetails?.planTitle || 'Lake Catch Member'}
                    </Text>
                    <Text style={styles.subPlanDays}>
                      {subDetails?.daysRemaining} days remaining in billing cycle
                    </Text>
                  </View>
                  <View style={styles.subActiveBadge}>
                    <Text style={styles.subActiveBadgeText}>
                      {subDetails?.status || 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                <View style={styles.subStatsRow}>
                  <View style={styles.subStatBox}>
                    <Text style={styles.subStatLabel}>Store Credit</Text>
                    <Text style={styles.subStatValue}>
                      ₹{parseFloat(subDetails?.creditBalance || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.subStatBox}>
                    <Text style={styles.subStatLabel}>Weekly Quota</Text>
                    <Text style={styles.subStatValue}>
                      {subDetails?.weeklyRemainingKg || 0} kg left
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.subActionBtn}
                  onPress={() => onNavigate('SUBSCRIPTION')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.subActionBtnText}>Manage Subscription Hub →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.noSubHeaderRow}>
                  <View style={styles.noSubIconBox}>
                    <Text style={{ fontSize: 20 }}>💳</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noSubTitle}>No Active Subscription</Text>
                    <Text style={styles.noSubSubtitle}>
                      Subscribe to unlock weekly fresh catch quota discounts and bonus store credit.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.exploreSubBtn}
                  onPress={() => onNavigate('SUBSCRIPTION')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.exploreSubBtnText}>Explore Subscription Plans →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Quick Navigation / Account Services */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>ACCOUNT SHORTCUTS</Text>
          </View>
          <View style={styles.menuContainer}>
            {/* Bookings & QR Tickets */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => onNavigate('BOOKING_HISTORY')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconCircle}>
                <Text style={styles.menuEmoji}>🎫</Text>
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>My Bookings & QR Tickets</Text>
                <Text style={styles.menuSubtitle}>Store pickup reservations & collection codes</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Scan Counter Bill */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => onNavigate('SCAN_BILL')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconCircle}>
                <Text style={styles.menuEmoji}>📷</Text>
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Scan Counter Bill</Text>
                <Text style={styles.menuSubtitle}>Process physical store receipt with AI OCR</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* In-Store Purchase Receipts */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => onNavigate('TRANSACTION_HISTORY')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconCircle}>
                <Text style={styles.menuEmoji}>🧾</Text>
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>In-Store Purchase Receipts</Text>
                <Text style={styles.menuSubtitle}>Counter bills and physical transaction history</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Live GPS Catch Tracking */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => onNavigate('LIVE_TRACKING')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconCircle}>
                <Text style={styles.menuEmoji}>🧭</Text>
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Live Catch GPS Tracking</Text>
                <Text style={styles.menuSubtitle}>Harbor-to-Bangalore cold-chain vehicle tracking</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Notification Center */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => onNavigate('NOTIFICATIONS')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconCircle}>
                <Text style={styles.menuEmoji}>🔔</Text>
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Notification Center</Text>
                <Text style={styles.menuSubtitle}>Fresh drop alerts and booking notifications</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Secure Logout Section */}
          <View style={styles.logoutWrapper}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogoutPress}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutBtnText}>🚪 Log Out of PondFish</Text>
            </TouchableOpacity>
            <Text style={styles.logoutDisclaimer}>
              Hardware-backed Keystore session will be safely cleared.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* CP-20A Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {Boolean(editError) && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{editError}</Text>
              </View>
            )}

            {/* Read-Only Mobile Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>VERIFIED MOBILE (READ-ONLY)</Text>
              <View style={[styles.textInput, styles.readOnlyInput]}>
                <Text style={styles.readOnlyText}>
                  {formatMobile(profile?.mobileNumber)}
                </Text>
                <Text style={{ fontSize: 13 }}>🔒</Text>
              </View>
              <Text style={styles.inputHelpText}>
                Mobile number is locked to your verified OTP credentials.
              </Text>
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FULL NAME *</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>

            {/* Age */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AGE (18 - 120) *</Text>
              <TextInput
                style={styles.textInput}
                value={editAge}
                onChangeText={setEditAge}
                placeholder="e.g. 32"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            {/* Area / Locality */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DELIVERY AREA / LOCALITY *</Text>
              <TextInput
                style={styles.textInput}
                value={editArea}
                onChangeText={setEditArea}
                placeholder="e.g. Indiranagar, Bangalore"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditModalVisible(false)}
                disabled={editLoading}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, editLoading && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={editLoading}
                activeOpacity={0.85}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 14,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    paddingRight: 14,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  appBarSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  editHeaderBtn: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editHeaderBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  successBanner: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.4)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  successBannerText: {
    color: colors.freshGreen,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  identityCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent,
  },
  identityDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.18)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedBadgeText: {
    color: colors.freshGreen,
    fontSize: 10,
    fontWeight: '800',
  },
  memberSinceText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  customerIdText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  identityDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  fieldGrid: {
    gap: 12,
  },
  fieldItem: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  fieldValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  fieldValText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  lockIcon: {
    fontSize: 12,
    opacity: 0.7,
  },
  fieldSubnote: {
    fontSize: 10,
    color: colors.textMuted,
  },
  sectionHeaderRow: {
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  subscriptionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  subCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subPlanInfo: {
    flex: 1,
  },
  subPlanTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subPlanDays: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 2,
  },
  subActiveBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subActiveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.freshGreen,
  },
  subStatsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
    marginBottom: 12,
  },
  subStatBox: {
    flex: 1,
  },
  subStatLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  subStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  subActionBtn: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.4)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  subActionBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  noSubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  noSubIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noSubTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  noSubSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  exploreSubBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  exploreSubBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  menuContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuEmoji: {
    fontSize: 18,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  menuSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  menuArrow: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  logoutWrapper: {
    marginTop: 6,
    alignItems: 'center',
  },
  logoutBtn: {
    width: '100%',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: colors.freshRed,
    fontSize: 15,
    fontWeight: '800',
  },
  logoutDisclaimer: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 17, 32, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modalErrorBox: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: colors.freshRed,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  modalErrorText: {
    color: colors.freshRed,
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  readOnlyInput: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readOnlyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  inputHelpText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
