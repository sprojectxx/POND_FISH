/**
 * Screen: CP-20 — Customer Profile & Services Screen
 * Traceability: PondFish Customer Mobile App UI Specification & Blinkit Coastal Standard
 * 
 * Provides:
 * 1. Seamless 0px status-bar-to-header continuous vertical linear gradient:
 *    linear-gradient(180deg, #6EA3D8 0%, #A9CBEB 45%, #DCEBFA 75%, #F5F7FA 100%)
 * 2. Transparent child containers with zero blocky steps, borders, or horizontal bands
 * 3. 3-card quick action row: Your orders | Subscription Money (₹1,500) | Need Help?
 * 4. Grouped white rounded cards with dividers matching Blinkit reference
 * 5. Zero clip-art emojis, no pass card, pure coastal palette and website typography
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StatusBar,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { api } from '../services/api';
import { clearAuthTokens } from '../services/auth-storage';

// Inlined hardware-accelerated continuous gradient PNG:
// 180deg: #6EA3D8 (0%) -> #A9CBEB (45%) -> #DCEBFA (75%) -> #F5F7FA (100%)
const GRADIENT_BG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAEACAYAAACUF9fcAAADaklEQVR4nI3IR3sUZBiF4fOLBUFRFEVRFBXEAoqiKKSThHTSSa+kkD59JtN7n0nybY4uz3W9WczifhYP3mvzUOFKm4cKV9o9VLja7qHC1XYvFd7v8FLZca3DS4VrnV4qXO/0UuF6p48KH3T5qOz4sNtHZceNbh8VbvT4qfBRj5/Kjo9f+qnsuPnST4WbvQEqfNIboLLj074AlR23+gJUuNUfpMJn/UEqOz5/FaSy4/ZAkAq3B0JU+OL/KHw5GKKy485giAp3hkJU+GooTGXH18NhKjvuDoepcHckTIVvRiJUdnw7GqGy495ohAr3xiJU+G7slMqO71+fUtnxw/gplR33x6NUuD8RpcKDiSiVHT9ORqnseDgZo8LDqRgVfpqKUdnx83SMyo5fpuNU+HUmTmXHo5k4FR7NxqnweDZOhcezCSr89iZBZcfvcwkqO57MJajwZD5JhT/mk1R2/LmQpLLj6UKSCk8XU1T4azFFZcffSykqO54tpajwbDlNhX+W01R2/LuSprLj+WqaCs9XM1R4sZqhwou1DBXa1jJUdrSvZ6jQsZ6lsqNzI0tlR9dGlgpdm1kqdG/mqOzoeZujsuPlVo4KvVs5KvRu5anQt52nQv92ngr9O3kqvNrJU2Fgp0CFgd0CFQZ3C1QYelegsmN4r0iFkb0ilR2j+0UqjO0XqTB2UKLC64MSFcYPSlQYPyxRYeKwRIXJozKVHVPHZSpMH5ep7Jg5qVBh9qRChVlPhQpvPBUqzHkqVJjzVqkw761SYcFXpbJj0V+lwpK/RmXHcqBGhZVAjQorwRoVVoM1KqyF6lR2rIfqVNgI16ns2Iw0qPA20qCyY+u0QYXt0wYVtqNNKuxEm1TYjTWp7HgXa1JhL35GZcd+4owKB4kzKjsOk+dUOEqeU+EodU6F49Q5FU7S51Q4SV9QwZO+oII3c0Flhy97QQV/1lHZEcg5KjuCOUeFYN5R2RHKOyo7wnlHdckoOCpECo7KjtOCo7pkFB0VokVHZUes6KguGSVHhXjJUdmRKDmqFkay7KhaGKmyo7IjXXFULYxMxVHZka06qhZGruqo7MhXHRXyNUdlR6HmqOwo1hwVinVHZUep7qjsKNcdFcoNR2VHpeGoWhjVhqNCtemoUGs6qhZGvemoUD9zVGicOSoz/gOQY73sI2lStwAAAABJRU5ErkJggg==';

export default function ProfileScreen({ routeParams = {}, onNavigate, onLogout }) {
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(routeParams?.customer || null);
  const [subscriptionState, setSubscriptionState] = useState(null);

  const isMountedRef = useRef(true);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, subRes] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getSubscription().catch(() => null),
      ]);

      if (!isMountedRef.current) return;

      if (profileRes?.data) {
        setProfile(profileRes.data);
      } else if (!profile && routeParams?.customer) {
        setProfile(routeParams.customer);
      }

      if (subRes?.data) {
        setSubscriptionState(subRes.data);
      }
    } catch (err) {
      console.warn('[PROFILE DATA ERROR]', err);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [profile, routeParams]);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your PondFish account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              if (typeof onLogout === 'function') {
                await onLogout();
              } else {
                await clearAuthTokens();
                if (onNavigate) onNavigate('PHONE_AUTH');
              }
            } catch (err) {
              Alert.alert('Logout Error', 'Unable to log out at this moment.');
            }
          },
        },
      ]
    );
  };

  const handleOpenWhatsApp = () => {
    const phone = '919876512345';
    const text = encodeURIComponent('Hi PondFish Support, I need assistance with my customer account.');
    const url = `whatsapp://send?phone=${phone}&text=${text}`;

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://wa.me/${phone}?text=${text}`);
      }
    }).catch(() => {
      Alert.alert('Customer Care', 'Please contact PondFish customer support at +91 98765 12345.');
    });
  };

  const customerName = profile?.name || 'PondFish Customer';
  const rawMobile = profile?.mobileNumber || '9347615308';
  const cleanMobile = String(rawMobile).replace(/^\+?91/, '').trim();
  const formattedPhone = cleanMobile.length === 10
    ? `+91 ${cleanMobile.slice(0, 5)} ${cleanMobile.slice(5)}`
    : `+91 ${cleanMobile}`;

  const userCreditBalance = subscriptionState?.subscription?.creditBalance
    ? `₹${parseFloat(subscriptionState.subscription.creditBalance).toLocaleString('en-IN')}`
    : '₹1,500';

  return (
    <View style={styles.container}>
      {/* Top Status Bar: Transparent & Translucent for continuous flow from 0px */}
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1E56A0"
            colors={['#1E56A0']}
          />
        }
      >
        {/* 1. TOP PROFILE HEADER WRAPPER (Starts at 0px with continuous gradient) */}
        <View
          style={[
            styles.topHeaderWrapper,
            {
              backgroundColor: '#6EA3D8',
              ...(Platform.OS === 'web'
                ? { background: 'linear-gradient(180deg, #6EA3D8 0%, #A9CBEB 45%, #DCEBFA 75%, #F5F7FA 100%)' }
                : {})
            }
          ]}
        >
          {/* Hardware-accelerated continuous vertical linear gradient (0px -> above 3 cards) */}
          <Image
            source={{ uri: GRADIENT_BG_BASE64 }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="stretch"
          />

          {/* Top Bar with Back Button (Transparent child container) */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backCircleBtn}
              onPress={() => onNavigate && onNavigate('HOME')}
              activeOpacity={0.8}
            >
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          </View>

          {/* Center Profile Avatar & User Details (Transparent child container) */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              {/* Minimalist Silhouette Person Icon */}
              <View style={styles.silhouetteHead} />
              <View style={styles.silhouetteShoulders} />
            </View>

            {/* User Name & Metadata */}
            <Text style={styles.profileName}>{customerName}</Text>
            <Text style={styles.profileMeta}>{formattedPhone} • PondFish Member</Text>
          </View>
        </View>

        {/* 2. 3 QUICK ACTION CARDS (Blinkit 3-Card Row) */}
        <View style={styles.quickCardsRow}>
          {/* Card 1: Your orders */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => onNavigate && onNavigate('BOOKING_HISTORY')}
            activeOpacity={0.85}
          >
            {/* Package / Shopping Bag Icon */}
            <View style={styles.iconContainer}>
              <Image
                source={require('../assets/icons/shopping_bag.png')}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.quickCardTitle}>Your orders</Text>
          </TouchableOpacity>

          {/* Card 2: Subscription Money */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => onNavigate && onNavigate('SUBSCRIPTION')}
            activeOpacity={0.85}
          >
            {/* Wallet / Rupee Line Art Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.walletOuter}>
                <View style={styles.walletBadge}>
                  <Text style={styles.walletRupeeChar}>₹</Text>
                </View>
              </View>
            </View>
            <Text style={styles.quickCardTitle}>Subscription</Text>
            <Text style={styles.quickCardAmount}>{userCreditBalance}</Text>
          </TouchableOpacity>

          {/* Card 3: Need help? */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={handleOpenWhatsApp}
            activeOpacity={0.85}
          >
            <View style={styles.iconContainer}>
              <Image
                source={require('../assets/icons/whatsapp_official.png')}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.quickCardTitle}>Need help?</Text>
          </TouchableOpacity>
        </View>

        {/* 3. GROUP 1: Appearance, Content preferences, Explore Subscriptions */}
        <View style={styles.groupedCard}>
          {/* Appearance Row */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Appearance', 'Theme is set to Light Mode.')}
          >
            <View style={styles.menuIconCol}>
              <Image
                source={require('../assets/icons/sun_icon.png')}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.menuLabel}>Appearance</Text>
            <View style={styles.lightPill}>
              <Text style={styles.lightPillText}>LIGHT ▾</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Content preferences Row */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Preferences', 'Freshwater & Marine catches preferred.')}
          >
            <View style={styles.menuIconCol}>
              <View style={styles.slidersIcon}>
                <View style={styles.sliderTrack1}><View style={styles.sliderKnob1} /></View>
                <View style={styles.sliderTrack2}><View style={styles.sliderKnob2} /></View>
              </View>
            </View>
            <Text style={styles.menuLabel}>Content preferences</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Explore Subscriptions Row */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => onNavigate && onNavigate('SUBSCRIPTION')}
          >
            <View style={styles.menuIconCol}>
              <View style={styles.badgeStarIcon}>
                <Text style={styles.badgeStarText}>★</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Explore subscriptions</Text>
              <Text style={styles.menuSubLabel}>Zero prep fees • Reserved morning harvest</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 4. SECTION 2: Your information */}
        <Text style={styles.sectionHeading}>Your information</Text>
        <View style={styles.groupedCard}>
          {/* Address book */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Address Book', 'Indiranagar Flagship Store is your active pickup counter.')}
          >
            <View style={styles.menuIconCol}>
              <Image
                source={require('../assets/icons/map_pin_icon.png')}
                style={{ width: 19, height: 19 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.menuLabel}>Address book</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Your bookings */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => onNavigate && onNavigate('BOOKING_HISTORY')}
          >
            <View style={styles.menuIconCol}>
              <Image
                source={require('../assets/icons/calendar_icon.png')}
                style={{ width: 19, height: 19 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.menuLabel}>Your bookings</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Notifications */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Notifications', 'SMS & Push notifications enabled for daily fresh harvest alerts.')}
          >
            <View style={styles.menuIconCol}>
              <Image
                source={require('../assets/icons/bell_icon.png')}
                style={{ width: 19, height: 19 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.menuLabel}>Notifications</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 5. SECTION 3: Payment and coupons */}
        <Text style={styles.sectionHeading}>Payment and coupons</Text>
        <View style={styles.groupedCard}>
          {/* Payment settings */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Payment Settings', 'UPI & Store Counter Payment enabled.')}
          >
            <View style={styles.menuIconCol}>
              <View style={styles.cardIcon}>
                <View style={styles.cardStrip} />
              </View>
            </View>
            <Text style={styles.menuLabel}>Payment settings</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Transaction history */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Transaction History', 'All counter payments and subscription credit top-ups.')}
          >
            <View style={styles.menuIconCol}>
              <View style={styles.receiptIcon}>
                <View style={styles.receiptLine} />
              </View>
            </View>
            <Text style={styles.menuLabel}>Transaction history</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 6. SECTION 4: Support */}
        <Text style={styles.sectionHeading}>Support</Text>
        <View style={styles.groupedCard}>
          {/* WhatsApp Support */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleOpenWhatsApp}
          >
            <View style={styles.menuIconContainer36}>
              <Image
                source={require('../assets/icons/whatsapp_official.png')}
                style={{ width: 28, height: 28 }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>WhatsApp support</Text>
              <Text style={styles.menuSubLabel}>+91 98765 12345 • Instant query help</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Terms & Conditions */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://pondfish.in/terms').catch(() => {
              Alert.alert('Terms & Conditions', 'Visit https://pondfish.in/terms to view our customer policy.');
            })}
          >
            <View style={styles.menuIconContainer36}>
              <Image
                source={require('../assets/icons/terms_icon.png')}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.menuLabel}>Terms & conditions</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Log Out */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <View style={styles.menuIconContainer36}>
              <Image
                source={require('../assets/icons/logout_icon.png')}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.menuLabel, { color: '#DC2626' }]}>Log out</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* App Version Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerVersion}>PondFish App v2.4.0 (Build 41)</Text>
          <Text style={styles.footerSub}>Certified Coastal Harvest & Farm Direct</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  topHeaderWrapper: {
    width: '100%',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 12,
    paddingBottom: 22,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#6EA3D8',
    borderWidth: 0,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  backCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 22,
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: 2,
    marginBottom: 0,
    borderWidth: 0,
  },
  avatarCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  silhouetteHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    marginBottom: 4,
  },
  silhouetteShoulders: {
    width: 52,
    height: 26,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#334155',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
    letterSpacing: -0.3,
    backgroundColor: 'transparent',
  },
  profileMeta: {
    fontSize: 13,
    color: '#475569',
    marginTop: 3,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  quickCardsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 6,
    gap: 10,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  basketHandle: {
    width: 14,
    height: 7,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#1E293B',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  basketBody: {
    width: 22,
    height: 14,
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  basketLine: {
    width: 12,
    height: 1,
    backgroundColor: '#1E293B',
  },
  walletOuter: {
    width: 24,
    height: 18,
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 4,
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 3,
  },
  walletBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F2C59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletRupeeChar: {
    fontSize: 7,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  chatBubbleOuter: {
    width: 22,
    height: 16,
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 5,
    padding: 2,
    justifyContent: 'center',
    gap: 2,
  },
  chatLine1: {
    width: 12,
    height: 1.5,
    backgroundColor: '#1E293B',
  },
  chatLine2: {
    width: 8,
    height: 1.5,
    backgroundColor: '#1E293B',
  },
  chatBubbleCorner: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1E293B',
    transform: [{ rotate: '180deg' }],
    marginLeft: 6,
    marginTop: -1,
  },
  quickCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  quickCardAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuIconContainer36: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  menuSubLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 56,
    marginRight: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 20,
    marginTop: 18,
    marginBottom: 8,
  },
  lightPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lightPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  sunIconCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunRayTop: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 3,
    backgroundColor: '#334155',
  },
  sunRayBottom: {
    position: 'absolute',
    bottom: -4,
    width: 2,
    height: 3,
    backgroundColor: '#334155',
  },
  sunRayLeft: {
    position: 'absolute',
    left: -4,
    width: 3,
    height: 2,
    backgroundColor: '#334155',
  },
  sunRayRight: {
    position: 'absolute',
    right: -4,
    width: 3,
    height: 2,
    backgroundColor: '#334155',
  },
  slidersIcon: {
    width: 18,
    height: 14,
    justifyContent: 'space-between',
  },
  sliderTrack1: {
    width: 18,
    height: 2,
    backgroundColor: '#CBD5E1',
    position: 'relative',
  },
  sliderKnob1: {
    position: 'absolute',
    left: 4,
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  sliderTrack2: {
    width: 18,
    height: 2,
    backgroundColor: '#CBD5E1',
    position: 'relative',
  },
  sliderKnob2: {
    position: 'absolute',
    right: 4,
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  badgeStarIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStarText: {
    fontSize: 12,
    color: '#0F2C59',
  },
  bookIcon: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 3,
  },
  ticketIcon: {
    width: 18,
    height: 13,
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 3,
    borderStyle: 'dashed',
  },
  bellIcon: {
    width: 14,
    height: 16,
    borderWidth: 2,
    borderColor: '#334155',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  cardIcon: {
    width: 18,
    height: 14,
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 3,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  cardStrip: {
    width: '100%',
    height: 2,
    backgroundColor: '#334155',
  },
  receiptIcon: {
    width: 14,
    height: 17,
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 2,
    alignItems: 'center',
    paddingTop: 3,
  },
  receiptLine: {
    width: 8,
    height: 1.5,
    backgroundColor: '#334155',
  },
  whatsappDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
  },
  termsIcon: {
    width: 14,
    height: 16,
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 2,
  },
  logoutIcon: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 3,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  footerVersion: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  footerSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});
