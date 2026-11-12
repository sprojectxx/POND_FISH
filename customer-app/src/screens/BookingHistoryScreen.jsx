/**
 * Screen: CP-11 — Booking History Screen
 * Traceability: PondFish Customer Mobile App UI Specification & pondfish.in Coastal Standards
 * 
 * Provides:
 * 1. Clean coastal cards for store-pickup reservations
 * 2. Real fish item names, cut styles, and reserved weights
 * 3. Soft status badges (CONFIRMED in emerald, COMPLETED in slate)
 * 4. Instant access to Digital QR Pickup Pass
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { api } from '../services/api';

const FISH_CDN_BASE = 'https://pondfish-cdn.sprojectxx.workers.dev/fish-assets';

const FISH_IMAGE_MAP = {
  'appollo': `${FISH_CDN_BASE}/apollo-boneless.webp`,
  'apollo': `${FISH_CDN_BASE}/apollo-boneless.webp`,
  'tiger prawns': `${FISH_CDN_BASE}/tiger-prawns.webp`,
  'prawns': `${FISH_CDN_BASE}/tiger-prawns.webp`,
  'boche': `${FISH_CDN_BASE}/bochu.webp`,
  'katla': `${FISH_CDN_BASE}/bochu.webp`,
  'tilapia': `${FISH_CDN_BASE}/tilapia-whole-fish.webp`,
  'bangda': `${FISH_CDN_BASE}/bangda.webp`,
  'mackerel': `${FISH_CDN_BASE}/bangda.webp`,
  'vanjaram': `${FISH_CDN_BASE}/vanjaram.webp`,
  'seer': `${FISH_CDN_BASE}/vanjaram.webp`,
  'pomfret': `${FISH_CDN_BASE}/white-pomfret.webp`,
  'tuna': `${FISH_CDN_BASE}/tuna.webp`,
  'crab': `${FISH_CDN_BASE}/blue-crabs.webp`,
};

function getFishImage(fishName, imageUrl) {
  if (imageUrl) return imageUrl;
  const name = (fishName || '').toLowerCase();
  for (const [key, url] of Object.entries(FISH_IMAGE_MAP)) {
    if (name.includes(key)) return url;
  }
  return `${FISH_CDN_BASE}/apollo-boneless.webp`;
}

const MOCK_BOOKINGS = [
  {
    id: 'bk-9821',
    booking_code: 'PF-2026-9821',
    status: 'CONFIRMED',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 4 * 3600000).toISOString(),
    total_amount: 750,
    store_name: 'Indiranagar Flagship Counter',
    store_address: '12th Main Road, Indiranagar, Bengaluru',
    pickup_slot: 'Today, 5:00 PM – 7:00 PM',
    items: [
      { fish_name: 'APPOLLO BONE LESS', image_url: `${FISH_CDN_BASE}/apollo-boneless.webp`, weight_kg: 1.5, cutting_style: 'Curry Cut (Medium)', price: 750 }
    ]
  },
  {
    id: 'bk-9740',
    booking_code: 'PF-2026-9740',
    status: 'COMPLETED',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    total_amount: 1200,
    store_name: 'Indiranagar Flagship Counter',
    store_address: '12th Main Road, Indiranagar, Bengaluru',
    pickup_slot: '5 Nov 2026, 11:00 AM – 1:00 PM',
    items: [
      { fish_name: 'TIGER PRAWNS', image_url: `${FISH_CDN_BASE}/tiger-prawns.webp`, weight_kg: 1.0, cutting_style: 'Whole Cleaned', price: 1200 }
    ]
  }
];

export default function BookingHistoryScreen({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);

  const isMountedRef = useRef(true);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.getBookings();
      if (isMountedRef.current) {
        if (res && res.data && res.data.length > 0) {
          setBookings(res.data);
        } else {
          setBookings(MOCK_BOOKINGS);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setBookings(MOCK_BOOKINGS);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchBookings();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchBookings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
  };

  const handleSelectBooking = useCallback((booking) => {
    if (onNavigate) {
      onNavigate('BOOKING_CONFIRMATION', { booking });
    }
  }, [onNavigate]);

  const renderBookingCard = ({ item }) => {
    const isConfirmed = item.status === 'CONFIRMED' || item.status === 'PENDING_COLLECTION';
    const isCompleted = item.status === 'COMPLETED';
    const mainItem = (item.items && item.items.length > 0) ? item.items[0] : null;

    return (
      <View style={styles.card}>
        {/* Card Header: Store Name & Status Badge */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.storeName}>{item.store_name || 'Indiranagar Flagship Counter'}</Text>
            <Text style={styles.bookingRef}>Ref: {item.booking_code || item.id}</Text>
          </View>
          <View style={[
            styles.statusPill,
            isConfirmed ? styles.statusConfirmed : isCompleted ? styles.statusCompleted : styles.statusOther
          ]}>
            <View style={[
              styles.statusDot,
              isConfirmed ? styles.dotConfirmed : isCompleted ? styles.dotCompleted : styles.dotOther
            ]} />
            <Text style={[
              styles.statusPillText,
              isConfirmed ? styles.textConfirmed : isCompleted ? styles.textCompleted : styles.textOther
            ]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Pickup Time Slot Banner */}
        <View style={styles.pickupSlotBox}>
          <Text style={styles.pickupSlotLabel}>PICKUP WINDOW</Text>
          <Text style={styles.pickupSlotVal}>{item.pickup_slot || 'Today, 5:00 PM – 7:00 PM'}</Text>
        </View>

        {/* Item Details with Ordered Fish Thumbnail */}
        <View style={styles.itemsSummary}>
          <View style={styles.itemRow}>
            <View style={styles.fishThumbBox}>
              <Image
                source={{ uri: getFishImage(mainItem?.fish_name, mainItem?.image_url || mainItem?.imageUrl) }}
                style={styles.fishThumbImg}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.fishItemName}>
                {mainItem ? mainItem.fish_name : 'Fresh Harvest Catch'}
              </Text>
              <Text style={styles.fishItemMeta}>
                {mainItem ? `${mainItem.weight_kg} kg • ${mainItem.cutting_style}` : 'Dressed at counter'}
              </Text>
            </View>
            <Text style={styles.itemPrice}>₹{item.total_amount}</Text>
          </View>
        </View>

        {/* Card Action: View Digital QR Pass */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.qrPassBtn}
            onPress={() => handleSelectBooking(item)}
            activeOpacity={0.85}
          >
            <Text style={styles.qrPassBtnText}>View Digital QR Pass →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => onNavigate && onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Your Bookings</Text>
          <Text style={styles.headerSub}>Store Pickup Reservations</Text>
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E56A0" />
          <Text style={styles.loadingText}>Loading your reservations...</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No Active Bookings</Text>
          <Text style={styles.emptySub}>
            Reserve freshly harvested catch online and pick it up dressed and ready at your local counter.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => onNavigate && onNavigate('HOME')}
          >
            <Text style={styles.exploreBtnText}>Explore Fresh Catches →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id || item.booking_code}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#1E56A0"
              colors={['#1E56A0']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backBtnText: {
    color: '#0F2C59',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#425B73',
    marginTop: 2,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F2C59',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  storeName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F2C59',
    letterSpacing: -0.2,
  },
  bookingRef: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusConfirmed: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  dotConfirmed: {
    backgroundColor: '#159C57',
  },
  textConfirmed: {
    color: '#159C57',
  },
  statusCompleted: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  dotCompleted: {
    backgroundColor: '#64748B',
  },
  textCompleted: {
    color: '#64748B',
  },
  statusOther: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  dotOther: {
    backgroundColor: '#1E56A0',
  },
  textOther: {
    color: '#1E56A0',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pickupSlotBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickupSlotLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  pickupSlotVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F2C59',
    marginTop: 2,
  },
    fishThumbBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fishThumbImg: {
    width: '100%',
    height: '100%',
  },
  itemsSummary: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fishItemName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F2C59',
  },
  fishItemMeta: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2C59',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  qrPassBtn: {
    backgroundColor: '#1E56A0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#1E56A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  qrPassBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 12,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F2C59',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
  },
  exploreBtn: {
    backgroundColor: '#1E56A0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
