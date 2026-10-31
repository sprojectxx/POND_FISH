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
import { clearAuthTokens, getDeviceToken } from '../services/auth-storage';

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
      // 1. Attempt to unregister FCM device registration token while still authenticated with valid session token
      try {
        const deviceToken = await getDeviceToken();
        if (deviceToken && typeof deviceToken === 'string' && deviceToken.trim()) {
          if (typeof api.unregisterDeviceToken === 'function') {
            await api.unregisterDeviceToken(deviceToken.trim());
          }
        }
      } catch (tokenErr) {
        // Non-fatal: network or server error during push unregistration must never block user logout
        console.warn('[LOGOUT] Non-fatal error during device token unregistration');
      }

      // 2. Delegate local session and device-token clearance to centralized authoritative App logout handler
      if (typeof onLogout === 'function') {
        await onLogout();
      } else {
        await clearAuthTokens();
        if (typeof onNavigate === 'function') {
          onNavigate('PHONE_AUTH');
        }
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
  const subDetails = subscriptionState?.subscription;  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFE" />

      {/* Screen Top Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity
            style={styles.brandIconBtn}
            onPress={() => onNavigate && onNavigate('HOME')}
            activeOpacity={0.7}
          >
            <Text style={styles.brandEmoji}>🐟</Text>
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Profile</Text>
        </View>

        <View style={styles.appBarRight}>
          {/* Top Wallet Pill */}
          <TouchableOpacity
            style={styles.walletPill}
            onPress={() => onNavigate && onNavigate('SUBSCRIPTION')}
            activeOpacity={0.8}
          >
            <Text style={styles.walletIcon}>💳</Text>
            <Text style={styles.walletAmount}>
              {subDetails?.creditBalance ? `₹${parseFloat(subDetails.creditBalance).toLocaleString('en-IN')}` : (hasSub ? '₹0' : 'Club')}
            </Text>
            <Text style={styles.walletChevron}>⌵</Text>
          </TouchableOpacity>

          {/* Profile Avatar Icon */}
          <View style={styles.avatarPillCircle}>
            <Text style={styles.avatarPillEmoji}>👤</Text>
          </View>
        </View>
      </View>

      {/* Body Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent || '#0284C7'} />
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
              tintColor={colors.accent || '#0284C7'}
              colors={['#0A1C33', '#0284C7']}
            />
          }
        >
          {/* Success Banner */}
          {Boolean(editSuccessMsg) && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>✓ {editSuccessMsg}</Text>
            </View>
          )}

          {/* Customer Identity Card (White, rounded 16px) */}
          <View style={styles.identityCard}>
            <View style={styles.identityTopRow}>
              {/* Navy Avatar Square with Initials */}
              <View style={styles.navyAvatarBox}>
                <Text style={styles.navyAvatarText}>{avatarInitials}</Text>
              </View>

              {/* Customer Info */}
              <View style={styles.identityDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.customerNameText} numberOfLines={1}>
                    {profile?.name || 'Stevan V.'}
                  </Text>
                  <View style={styles.verifiedCheckBadge}>
                    <Text style={styles.verifiedCheckText}>✔</Text>
                  </View>
                </View>

                <Text style={styles.maskedPhoneText}>
                  {profile?.mobileNumber ? formatMobile(profile.mobileNumber) : '+91 98765 ••••• (Verified OTP)'}
                </Text>

                {/* Badges Row */}
                <View style={styles.identityBadgesRow}>
                  <View style={styles.goldSubscriberBadge}>
                    <Text style={styles.badgeMedalIcon}>🎖</Text>
                    <Text style={styles.goldSubscriberBadgeText}>
                      {hasSub ? `${subDetails?.planTitle || 'Gold'} Plan Subscriber` : 'Club Member'}
                    </Text>
                  </View>

                  <View style={styles.localityBadge}>
                    <Text style={styles.localityBadgeText}>
                      {profile?.area || 'Madhapur, HYD'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Edit Button */}
              <TouchableOpacity
                style={styles.editProfileBtn}
                onPress={handleOpenEdit}
                activeOpacity={0.75}
              >
                <Text style={styles.editProfileBtnText}>✏ Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Pickup Ticket Banner */}
          <View style={styles.pickupTicketBanner}>
            <View style={styles.pickupTicketIconBox}>
              <Text style={styles.pickupTicketIcon}>🪪</Text>
            </View>
            <View style={styles.pickupTicketInfo}>
              <View style={styles.pickupTicketTitleRow}>
                <View style={styles.ticketLiveDot} />
                <Text style={styles.pickupTicketTitle}>1 Live Pickup Ticket</Text>
              </View>
              <Text style={styles.pickupTicketSubtitle}>
                Madhapur Dock #04 • Ready in 12m
              </Text>
            </View>
            <TouchableOpacity
              style={styles.showQrBtn}
              onPress={() => onNavigate && onNavigate('BOOKING_HISTORY')}
              activeOpacity={0.85}
            >
              <Text style={styles.showQrBtnText}>Show QR</Text>
            </TouchableOpacity>
          </View>

          {/* 3 Stat Boxes in a Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>24</Text>
              <Text style={styles.statLabel}>TOTAL ORDERS</Text>
            </View>
            <View style={styles.statBoxDivider} />
            <View style={styles.statBox}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.statNumber}>18.4</Text>
                <Text style={styles.statUnit}>kg</Text>
              </View>
              <Text style={styles.statLabel}>QUOTA CLAIMED</Text>
            </View>
            <View style={styles.statBoxDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>₹4,850</Text>
              <Text style={styles.statLabel}>SAVED OVERALL</Text>
            </View>
          </View>

          {/* Section 1: ORDERS & BOOKINGS */}
          <Text style={styles.groupSectionTitle}>ORDERS & BOOKINGS</Text>
          <View style={styles.menuGroupCard}>
            {/* Active Booking & QR Tickets */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => onNavigate && onNavigate('BOOKING_HISTORY')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#EBF3FC' }]}>
                <Text style={styles.menuGlyph}>🎫</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Active Booking & QR Tickets</Text>
                <Text style={styles.menuItemSubtitle}>1 Active pickup pass generated</Text>
              </View>
              <View style={styles.menuRightIndicator}>
                <View style={styles.notificationDot} />
                <Text style={styles.menuChevron}>›</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.groupItemDivider} />

            {/* Order History & Scanned Bills */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => onNavigate && onNavigate('TRANSACTION_HISTORY')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#EDF5FD' }]}>
                <Text style={styles.menuGlyph}>🧾</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Order History & Scanned Bills</Text>
                <Text style={styles.menuItemSubtitle}>24 receipts • App orders & offline store bills</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.groupItemDivider} />

            {/* Live GPS Catch Tracking */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => onNavigate && onNavigate('LIVE_TRACKING')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#E8F5E9' }]}>
                <Text style={styles.menuGlyph}>🚚</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Live GPS Catch Tracking</Text>
                <Text style={styles.menuItemSubtitle}>Harbor Reefer Van #08 reaching Hub in 22 mins</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Section 2: SUBSCRIPTIONS & BALANCES */}
          <Text style={styles.groupSectionTitle}>SUBSCRIPTIONS & BALANCES</Text>
          <View style={styles.menuGroupCard}>
            {/* PondFish Wallet & Instant Cash */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => onNavigate && onNavigate('SUBSCRIPTION')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#EBF3FC' }]}>
                <Text style={styles.menuGlyph}>👛</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>PondFish Wallet & Instant Cash</Text>
                <Text style={styles.menuItemSubtitle}>Auto-refunds enabled</Text>
              </View>
              <View style={styles.menuRightIndicator}>
                <Text style={styles.walletBalanceBadge}>
                  ₹{subDetails?.creditBalance ? parseFloat(subDetails.creditBalance).toLocaleString('en-IN') : '0'}
                </Text>
                <Text style={styles.menuChevron}>›</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.groupItemDivider} />

            {/* Manage Gold Subscription */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => onNavigate && onNavigate('SUBSCRIPTION')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.menuGlyph}>✪</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>
                  {hasSub ? 'Manage Subscription' : 'Explore Subscriptions'}
                </Text>
                <Text style={styles.menuItemSubtitle}>
                  {hasSub
                    ? `${subDetails?.planTitle || 'Gold Plan'} • ${subDetails?.weeklyRemainingKg ?? 0} kg fresh quota left`
                    : 'No active plan • Subscribe to unlock weekly quota'}
                </Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.groupItemDivider} />

            {/* Saved Payment Methods */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => Alert.alert('Saved Payment Methods', 'Razorpay UPI & Saved cards managed securely at checkout.')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.menuGlyph}>💳</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Saved Payment Methods</Text>
                <Text style={styles.menuItemSubtitle}>Razorpay UPI (GPay) • HDFC Debit Ending 4192</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Section 3: PREFERENCES & PREPARATION */}
          <Text style={styles.groupSectionTitle}>PREFERENCES & PREPARATION</Text>
          <View style={styles.menuGroupCard}>
            {/* Delivery Addresses */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => Alert.alert('Delivery Addresses', `Current Primary Address:\n${profile?.area || 'Madhapur, Hyderabad'}\nOffice: Financial District`)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#FEE2E2' }]}>
                <Text style={styles.menuGlyph}>📍</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Delivery Addresses</Text>
                <Text style={styles.menuItemSubtitle}>Home (Madhapur), Office (Financial District)</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.groupItemDivider} />

            {/* Cutting & Cleaning Defaults */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => Alert.alert('Cutting Preferences', 'Default custom cut: Curry Cut with Head, Boneless Skinless Fillets.')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#E0F2FE' }]}>
                <Text style={styles.menuGlyph}>✂</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Cutting & Cleaning Defaults</Text>
                <Text style={styles.menuItemSubtitle}>Curry Cut with Head • Boneless Skinless Fillets</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.groupItemDivider} />

            {/* Notifications & Catch Alerts */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => onNavigate && onNavigate('NOTIFICATIONS')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#EDE9FE' }]}>
                <Text style={styles.menuGlyph}>🔔</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Notifications & Catch Alerts</Text>
                <Text style={styles.menuItemSubtitle}>WhatsApp updates & 6:00 AM Fresh Catch ping</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Section 4: ASSURANCE & LEGAL */}
          <Text style={styles.groupSectionTitle}>ASSURANCE & LEGAL</Text>
          <View style={styles.menuGroupCard}>
            {/* WhatsApp Care & Support */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => Alert.alert('PondFish Care', 'Seafood concierge available 24x7 via WhatsApp (+91 98765 43210).')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#DCFCE7' }]}>
                <Text style={styles.menuGlyph}>💬</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>WhatsApp Care & Support</Text>
                <Text style={styles.menuItemSubtitle}>24x7 instant seafood concierge help</Text>
              </View>
              <Text style={styles.externalLinkIcon}>↗</Text>
            </TouchableOpacity>

            <View style={styles.groupItemDivider} />

            {/* Cold-Chain Certificate & Lab Audits */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => Alert.alert('Lab Audits', 'Daily chemical testing results:\nFormalin: Not Detected (0.00 ppm)\nAmmonia: 0.00 ppm\nTested at Central Cold Hub, Hyderabad.')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#E0E7FF' }]}>
                <Text style={styles.menuGlyph}>🧪</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Cold-Chain Certificate & Lab Audits</Text>
                <Text style={styles.menuItemSubtitle}>Formalin-free, zero ammonia test batch #882</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.groupItemDivider} />

            {/* Terms & Refund Guarantees */}
            <TouchableOpacity
              style={styles.menuGroupItem}
              onPress={() => Alert.alert('Refund Policy', 'PondFish 100% Quality Guarantee: Any dissatisfaction reported within 48 hours receives immediate wallet refund or replacement without returns.')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#EDF5FD' }]}>
                <Text style={styles.menuGlyph}>🛡</Text>
              </View>
              <View style={styles.menuItemDetails}>
                <Text style={styles.menuItemTitle}>Terms & Refund Guarantees</Text>
                <Text style={styles.menuItemSubtitle}>100% no-questions replacement policy</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Log Out Button (Soft pink background with red text) */}
          <TouchableOpacity
            style={styles.stitchLogoutBtn}
            onPress={handleLogoutPress}
            activeOpacity={0.8}
          >
            <Text style={styles.stitchLogoutText}>⇥ Log Out</Text>
          </TouchableOpacity>

          {/* Footer Info */}
          <View style={styles.footerContainer}>
            <View style={styles.footerBulletRow}>
              <View style={styles.footerDot} />
              <Text style={styles.footerVersionText}>PondFish Hub v1.4.2</Text>
            </View>
            <Text style={styles.footerBuildText}>Build 204 • Pure Ocean Cold Chain Distribution</Text>
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
                placeholderTextColor="#94A3B8"
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
                placeholderTextColor="#94A3B8"
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
                placeholder="e.g. Madhapur, Hyderabad"
                placeholderTextColor="#94A3B8"
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
    backgroundColor: '#F8FAFE',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 14,
    backgroundColor: '#F8FAFE',
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconBtn: {
    padding: 2,
  },
  brandEmoji: {
    fontSize: 22,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1C33',
    letterSpacing: -0.3,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF5FD',
    borderWidth: 1,
    borderColor: '#C6DEF9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  walletIcon: {
    fontSize: 14,
  },
  walletAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1C33',
  },
  walletChevron: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '800',
  },
  avatarPillCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0A1C33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPillEmoji: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#0A1C33',
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
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  successBannerText: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  navyAvatarBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0A1C33',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navyAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  identityDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0A1C33',
    letterSpacing: -0.2,
  },
  verifiedCheckBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCheckText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  maskedPhoneText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  identityBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  goldSubscriberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF5FD',
    borderWidth: 1,
    borderColor: '#C6DEF9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeMedalIcon: {
    fontSize: 11,
  },
  goldSubscriberBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  localityBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  localityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  editProfileBtn: {
    borderWidth: 1,
    borderColor: '#C6DEF9',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginLeft: 6,
  },
  editProfileBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  pickupTicketBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF5FD',
    borderWidth: 1,
    borderColor: '#C6DEF9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  pickupTicketIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pickupTicketIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  pickupTicketInfo: {
    flex: 1,
  },
  pickupTicketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
  },
  pickupTicketTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1C33',
  },
  pickupTicketSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  showQrBtn: {
    backgroundColor: '#0A1C33',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  showQrBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    height: '75%',
    alignSelf: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1C33',
  },
  statUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    marginLeft: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  groupSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
    paddingLeft: 2,
  },
  menuGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  menuGroupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuGlyph: {
    fontSize: 16,
  },
  menuItemDetails: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A1C33',
  },
  menuItemSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  menuRightIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notificationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0284C7',
  },
  walletBalanceBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1C33',
  },
  menuChevron: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '600',
    marginLeft: 4,
  },
  externalLinkIcon: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  groupItemDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 48,
  },
  stitchLogoutBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  stitchLogoutText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
  },
  footerVersionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  footerBuildText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 28, 51, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#0A1C33',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },
  modalErrorBox: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  modalErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: '#F8FAFE',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0A1C33',
  },
  readOnlyInput: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readOnlyText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  inputHelpText: {
    fontSize: 10,
    color: '#94A3B8',
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
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#0A1C33',
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
