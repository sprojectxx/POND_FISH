/**
 * Screen: CP-10 — Customer Notification Center
 * Traceability: PondFish Customer Mobile App UI Specification (Section 61-65), Complete Design System (CP-05)
 * 
 * Features:
 * - Permanent in-app notification history.
 * - Category filter tabs: All, Bookings, Subscriptions, Delivery, System.
 * - Read / unread status indicators.
 * - Mark individual notification as read on press.
 * - "Mark All Read" action button in header.
 * - Deep linking to relevant app surfaces (Bookings, Subscription, Marketplace).
 * - Empty state: "You're all caught up."
 * - Pull-to-refresh support.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';

const CATEGORIES = [
  { key: 'ALL', label: 'All' },
  { key: 'BOOKING', label: 'Bookings' },
  { key: 'SUBSCRIPTION', label: 'Subscriptions' },
  { key: 'DELIVERY', label: 'Delivery' },
  { key: 'SYSTEM', label: 'System' },
];

export default function NotificationsScreen({ onNavigate }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async (cat = selectedCategory) => {
    try {
      setError(null);
      const res = await api.getNotifications({
        limit: 50,
        offset: 0,
        type: cat === 'ALL' ? null : cat,
      });

      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS SCREEN ERROR]', err.message);
      setError(err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    setLoading(true);
    fetchNotifications(selectedCategory);
  }, [selectedCategory, fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(selectedCategory);
  }, [selectedCategory, fetchNotifications]);

  async function handleNotificationPress(item) {
    // Optimistically update read state in UI
    if (!item.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));

      try {
        await api.markNotificationRead(item.id);
      } catch (e) {
        console.warn('[MARK READ FAILED]', e.message);
      }
    }

    // Documented Deep Link Routing (CP-10 Spec Section 63)
    const typeUpper = (item.type || '').toUpperCase();
    if (typeUpper === 'BOOKING') {
      onNavigate('BOOKING_HISTORY');
    } else if (typeUpper === 'SUBSCRIPTION') {
      onNavigate('SUBSCRIPTION');
    } else if (typeUpper === 'DELIVERY') {
      onNavigate('HOME');
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAll) return;
    try {
      setMarkingAll(true);
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('[MARK ALL READ ERROR]', err.message);
    } finally {
      setMarkingAll(false);
    }
  }

  function getCategoryIcon(type) {
    switch ((type || '').toUpperCase()) {
      case 'BOOKING':
        return '🎫';
      case 'SUBSCRIPTION':
        return '⭐';
      case 'DELIVERY':
        return '🚚';
      case 'SYSTEM':
      default:
        return '📢';
    }
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return '';
    }
  }

  const renderNotificationCard = ({ item }) => {
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 18 }}>{getCategoryIcon(item.type)}</Text>
          </View>
          <View style={styles.titleArea}>
            <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>
              {item.title}
            </Text>
            <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
          </View>
          {isUnread && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.cardMessage}>{item.message}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgMain} />

      {/* Header */}
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('HOME')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleArea}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllRead}
            disabled={markingAll}
            activeOpacity={0.7}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.markAllButtonText}>Mark read</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Category Filter Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item.key;
            return (
              <TouchableOpacity
                style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                onPress={() => setSelectedCategory(item.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabButtonText, isSelected && styles.tabButtonTextActive]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Unable to load notifications</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchNotifications(selectedCategory)}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptySubtitle}>
            {selectedCategory === 'ALL'
              ? 'No notifications yet. Important updates about your bookings and subscriptions will appear here.'
              : `No ${selectedCategory.toLowerCase()} notifications at this time.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationCard}
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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  headerTitleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  markAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.bgSurface,
  },
  markAllButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  tabsContainer: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabButtonTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: {
    borderColor: colors.accent,
    backgroundColor: '#0F1A1B',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleArea: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardTitleUnread: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cardTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 8,
  },
  cardMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    paddingLeft: 48,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});
