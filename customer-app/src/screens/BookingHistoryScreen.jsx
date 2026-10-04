/**
 * PondFish Customer Booking History Screen (CP-11)
 * Traceability: PondFish Page-by-Page UI Specification (Sections 66-70) & API Spec (Section 37)
 * Displays customer's reserved bookings with status badges and instant QR ticket access.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';

export default function BookingHistoryScreen({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getBookings();
      setBookings(res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load booking history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchBookings();
  }

  async function handleSelectBooking(bookingId) {
    try {
      const res = await api.getBookingDetails(bookingId);
      onNavigate('BOOKING_CONFIRMATION', { booking: res.data });
    } catch (err) {
      alert(err.message || 'Could not load booking details.');
    }
  }

  function renderStatusBadge(status, expiresAt) {
    const isExpired = expiresAt && new Date(expiresAt) < new Date() && status === 'CONFIRMED';
    const displayStatus = isExpired ? 'EXPIRED' : status;

    let badgeStyle = styles.badgePending;
    if (displayStatus === 'CONFIRMED' || displayStatus === 'PENDING_COLLECTION') {
      badgeStyle = styles.badgeConfirmed;
    } else if (displayStatus === 'COMPLETED') {
      badgeStyle = styles.badgeCompleted;
    } else if (displayStatus === 'CANCELLED' || displayStatus === 'EXPIRED') {
      badgeStyle = styles.badgeCancelled;
    }

    return (
      <View style={[styles.badge, badgeStyle]}>
        <Text style={styles.badgeText}>{displayStatus}</Text>
      </View>
    );
  }

  function renderBookingItem({ item }) {
    const createdDate = new Date(item.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => handleSelectBooking(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.bookingCode}>{item.booking_code}</Text>
            <Text style={styles.bookingDate}>{createdDate}</Text>
          </View>
          {renderStatusBadge(item.status, item.expires_at)}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Items</Text>
            <Text style={styles.metricVal}>{item.item_count || 1} catch varieties</Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Reserved Weight</Text>
            <Text style={styles.metricVal}>{item.total_quantity_kg || 0} kg</Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Total Value</Text>
            <Text style={styles.metricVal}>₹{item.total_amount}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.viewQrText}>View Digital QR Ticket →</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate('HOME')}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.appBarTitle}>Your Bookings</Text>
          <Text style={styles.appBarSubtitle}>Store Pickup Reservations</Text>
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Fetching your reservation tickets...</Text>
        </View>
      ) : error ? (
        <View style={[styles.container, styles.center]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchBookings}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : bookings.length === 0 ? (
        <View style={[styles.container, styles.center]}>
          <Text style={styles.emptyEmoji}>🎫</Text>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySub}>
            Reserve fresh lake catch online and pick it up at the store with your digital QR ticket.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => onNavigate('MARKETPLACE')}>
            <Text style={styles.retryBtnText}>Explore Fish Marketplace</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.primary]}
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
    backgroundColor: colors.bgMain,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  appBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  appBarSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingCode: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.accent,
  },
  bookingDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeConfirmed: {
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
  },
  badgePending: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
  },
  badgeCompleted: {
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
  },
  badgeCancelled: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.3)',
  },
  metricCol: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardFooter: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  viewQrText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  errorText: {
    color: colors.freshRed,
    fontSize: 13,
    marginBottom: 12,
  },
});
