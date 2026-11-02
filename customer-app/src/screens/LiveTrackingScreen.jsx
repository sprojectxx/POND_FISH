/**
 * CP-14 / CP-19: Live Delivery Tracking Screen
 * Traceability: PondFish Master PRD v2 (Section 22), Customer Mobile UI Specification
 * Displays real-time dedicated truck GPS location, origin-to-store journey progress,
 * stale GPS detection, geofenced store arrival, and fish cargo manifest.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  AppState,
} from 'react-native';
import { colors } from '../theme/colors';
import { api } from '../services/api';

export default function LiveTrackingScreen({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(null);
  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const fetchTracking = useCallback(async (isPullOrOptions = false, isForegroundFlag = false) => {
    let isPull = false;
    let isForeground = false;
    if (typeof isPullOrOptions === 'boolean') {
      isPull = isPullOrOptions;
      isForeground = Boolean(isForegroundFlag);
    } else if (isPullOrOptions && typeof isPullOrOptions === 'object') {
      isPull = Boolean(isPullOrOptions.isPull);
      isForeground = Boolean(isPullOrOptions.isForeground || isPullOrOptions.force);
    }

    if (!isMountedRef.current) return;

    // Routine background polling is prohibited while the app is backgrounded
    if (!isPull && appStateRef.current !== 'active') return;

    const hasActiveInFlight = activeRequestIdRef.current !== null;
    const isPreviousAborted = Boolean(abortControllerRef.current?.signal?.aborted);

    // If another request is currently active and not yet aborted:
    if (hasActiveInFlight && !isPreviousAborted) {
      if (isPull || isForeground) {
        // Manual pull-to-refresh or foreground return supersedes the existing in-flight poll
        if (abortControllerRef.current) {
          try {
            abortControllerRef.current.abort();
          } catch (_) {
            // Fallback for custom abort implementations
          }
        }
      } else {
        // Routine background poll: prevent duplicate or overlapping requests
        return;
      }
    }

    // Allocate new unique request identity and take exclusive active ownership
    const currentSeq = ++requestSeqRef.current;
    activeRequestIdRef.current = currentSeq;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortControllerRef.current = controller;

    if (isPull) setRefreshing(true);

    try {
      if (isMountedRef.current && currentSeq === requestSeqRef.current) {
        setError(null);
      }
      const res = await api.getCustomerLiveTracking({ signal: controller?.signal });

      // Stale response guard: discard if unmounted or if superseded by a newer request
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) {
        return;
      }

      if (res && res.success) {
        setTrackingData(res.data);
      } else {
        setError(res?.error?.message || 'Could not load live tracking.');
      }
    } catch (err) {
      // Stale response guard in catch block
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) {
        return;
      }
      if (err && (err.name === 'AbortError' || err.code === 'API_ABORTED')) {
        return; // Expected cancellation; do not surface error
      }
      setError(err?.message || 'Unable to connect to live tracking service.');
    } finally {
      // Clear request ownership and abort controller ONLY if this request is still the active owner
      if (activeRequestIdRef.current === currentSeq) {
        activeRequestIdRef.current = null;
        abortControllerRef.current = null;
      }
      if (isMountedRef.current && currentSeq === requestSeqRef.current) {
        setLoading(false);
        if (isPull) setRefreshing(false);
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    // Only schedule timer if screen is mounted and app is in foreground
    if (isMountedRef.current && appStateRef.current === 'active') {
      pollingTimerRef.current = setInterval(() => {
        if (isMountedRef.current && appStateRef.current === 'active') {
          fetchTracking(false);
        }
      }, 15000);
    }
  }, [fetchTracking, stopPolling]);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch when screen mounts
    fetchTracking(false);
    startPolling();

    // AppState lifecycle listener: stop polling when backgrounded, resume when active
    const handleAppStateChange = (nextAppState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && prev.match(/inactive|background/)) {
        // App returned to foreground: guarantee one immediate refresh and restart interval safely
        if (isMountedRef.current) {
          fetchTracking(false, true);
          startPolling();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App entered background: suspend polling and abort in-flight non-essential poll
        stopPolling();
        if (abortControllerRef.current) {
          try {
            abortControllerRef.current.abort();
          } catch (_) {}
        }
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (_) {}
      }
      activeRequestIdRef.current = null;
      abortControllerRef.current = null;
      if (appStateSub && typeof appStateSub.remove === 'function') {
        appStateSub.remove();
      }
    };
  }, [fetchTracking, startPolling, stopPolling]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Connecting to Live GPS Stream...</Text>
      </View>
    );
  }

  if (error && !trackingData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => onNavigate('HOME')}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Live Catch Tracking</Text>
            <Text style={styles.headerSubtitle}>Harbor-to-Counter Dedicated Truck</Text>
          </View>
        </View>

        <View style={styles.centerContainer}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
          <Text style={styles.emptyTitle}>Live Tracking Unavailable</Text>
          <Text style={styles.emptyMessage}>{error}</Text>
          <TouchableOpacity
            style={[styles.browseButton, { marginTop: 16 }]}
            onPress={() => fetchTracking(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.browseButtonText}>Retry Connection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.browseButton, { marginTop: 10, backgroundColor: colors.bgSurface }]}
            onPress={() => onNavigate('HOME')}
            activeOpacity={0.8}
          >
            <Text style={[styles.browseButtonText, { color: colors.textPrimary }]}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLive = trackingData?.active;
  const tracking = trackingData;

  return (
    <View style={styles.container}>
      {/* Top App Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onNavigate('HOME')}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Live Catch Tracking</Text>
          <Text style={styles.headerSubtitle}>Harbor-to-Counter Dedicated Truck</Text>
        </View>
        <TouchableOpacity
          onPress={() => fetchTracking(true)}
          style={styles.refreshButton}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16 }}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTracking(true)}
            tintColor={colors.accent}
          />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠ {error}</Text>
          </View>
        )}

        {!isLive ? (
          /* Empty / Inactive Delivery State */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Text style={{ fontSize: 40 }}>🚛</Text>
            </View>
            <Text style={styles.emptyTitle}>No Delivery Currently En Route</Text>
            <Text style={styles.emptyMessage}>
              {trackingData?.message ||
                'Our dedicated GPS-tracked refrigerated truck delivers fresh catch directly from local fishing harbors to the counter. Tracking activates when the next harbor delivery departs.'}
            </Text>

            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => onNavigate('HOME')}
              activeOpacity={0.8}
            >
              <Text style={styles.browseButtonText}>Browse Today’s Catch</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Active Live Tracking Content */
          <>
            {/* Status Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.statusRow}>
                <View style={styles.liveBadge}>
                  <View
                    style={[
                      styles.pulseDot,
                      { backgroundColor: tracking.isArrived ? colors.freshGreen : '#22C55E' },
                    ]}
                  />
                  <Text style={styles.liveBadgeText}>
                    {tracking.isArrived ? 'TRUCK ARRIVED' : 'EN ROUTE'}
                  </Text>
                </View>
                <Text style={styles.truckNumberText}>🚛 {tracking.truckNumber}</Text>
              </View>

              <Text style={styles.heroHeading}>
                {tracking.isArrived
                  ? 'Truck Arrived at PondFish Counter! 🐟'
                  : 'Fresh Catch on the Way to Store'}
              </Text>

              <Text style={styles.heroSub}>
                Driver: <Text style={{ color: colors.textPrimary }}>{tracking.driverName}</Text>
              </Text>

              {/* Stale Warning Banner */}
              {tracking.isStale && (
                <View style={styles.staleBanner}>
                  <Text style={styles.staleBannerText}>
                    ⚠ GPS signal is momentarily stale. Showing last recorded position.
                  </Text>
                </View>
              )}

              {/* Post-Arrival Window Countdown */}
              {tracking.isArrived && (
                <View style={styles.arrivedBanner}>
                  <Text style={styles.arrivedBannerText}>
                    ✓ Arrived at {new Date(tracking.arrivedAt).toLocaleTimeString()}. Fresh fish is being unloaded and prepared for counter display.
                  </Text>
                  {tracking.remainingPostArrivalMinutes !== null && (
                    <Text style={styles.arrivedTimerText}>
                      Live tracking closes in {tracking.remainingPostArrivalMinutes} minutes.
                    </Text>
                  )}
                </View>
              )}

              {/* Telemetry Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>DISTANCE TO STORE</Text>
                  <Text style={styles.statValue}>
                    {tracking.distanceMeters !== null
                      ? tracking.distanceMeters < 1000
                        ? `${tracking.distanceMeters} m`
                        : `${(tracking.distanceMeters / 1000).toFixed(1)} km`
                      : '--'}
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>CURRENT SPEED</Text>
                  <Text style={styles.statValue}>
                    {tracking.latestPosition?.speed !== null && tracking.latestPosition?.speed !== undefined
                      ? `${Math.round(tracking.latestPosition.speed)} km/h`
                      : '--'}
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>STORE GEOFENCE</Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: tracking.insideGeofence ? colors.freshGreen : colors.accent },
                    ]}
                  >
                    {tracking.insideGeofence ? 'INSIDE (ARRIVED)' : 'APPROACHING'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Route Schematic Card */}
            <View style={styles.routeCard}>
              <Text style={styles.sectionTitle}>Journey Progression</Text>

              <View style={styles.routeTrack}>
                {/* Step 1: Origin */}
                <View style={styles.routeStep}>
                  <View style={[styles.stepCircle, styles.stepCircleCompleted]}>
                    <Text style={styles.stepCircleIcon}>⚓</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>
                      {tracking.origin?.name || 'Fresh Catch Harbor'}
                    </Text>
                    <Text style={styles.stepSub}>Departed with morning catch</Text>
                  </View>
                </View>

                {/* Vertical Line */}
                <View style={styles.routeLine} />

                {/* Step 2: Truck Current Position */}
                <View style={styles.routeStep}>
                  <View
                    style={[
                      styles.stepCircle,
                      tracking.isArrived ? styles.stepCircleCompleted : styles.stepCircleActive,
                    ]}
                  >
                    <Text style={styles.stepCircleIcon}>🚛</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>
                      {tracking.isArrived ? 'Store Counter Arrival' : 'Temperature-Controlled Transit'}
                    </Text>
                    {tracking.latestPosition && (
                      <Text style={styles.stepCoords}>
                        GPS: {tracking.latestPosition.latitude.toFixed(4)}°, {tracking.latestPosition.longitude.toFixed(4)}°
                      </Text>
                    )}
                  </View>
                </View>

                {/* Vertical Line */}
                <View style={styles.routeLine} />

                {/* Step 3: Store Destination */}
                <View style={styles.routeStep}>
                  <View
                    style={[
                      styles.stepCircle,
                      tracking.isArrived ? styles.stepCircleCompleted : styles.stepCirclePending,
                    ]}
                  >
                    <Text style={styles.stepCircleIcon}>🏬</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>
                      {tracking.destination?.name || 'PondFish Flagship Store'}
                    </Text>
                    <Text style={styles.stepSub}>
                      {tracking.destination?.address || 'Water Town Flagship Counter'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Fish Cargo Manifest Card */}
            <View style={styles.manifestCard}>
              <View style={styles.manifestHeader}>
                <Text style={styles.sectionTitle}>Fresh Catch Manifest Onboard</Text>
                <Text style={styles.manifestTag}>TODAY'S INCOMING BATCH</Text>
              </View>

              {Array.isArray(tracking.fishManifest) && tracking.fishManifest.length > 0 ? (
                <View style={styles.manifestList}>
                  {tracking.fishManifest.map((fish, index) => (
                    <View key={index} style={styles.manifestItem}>
                      <View style={styles.fishIconBadge}>
                        <Text style={{ fontSize: 18 }}>🐟</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.fishItemName}>{fish.fishName}</Text>
                        <Text style={styles.fishItemSub}>Fresh harbor lot</Text>
                      </View>
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyText}>{fish.quantityKg} kg</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyManifestText}>
                  Fresh catch manifest details loading from harbour dispatcher...
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.bgMain,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: colors.textSecondary,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.accent,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: 'center',
    marginTop: 32,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  heroCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  liveBadgeText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  truckNumberText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  heroHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  staleBanner: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  staleBannerText: {
    color: '#FCD34D',
    fontSize: 12,
  },
  arrivedBanner: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  arrivedBannerText: {
    color: '#86EFAC',
    fontSize: 13,
    fontWeight: '500',
  },
  arrivedTimerText: {
    color: '#FCD34D',
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    padding: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  routeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  routeTrack: {
    paddingLeft: 6,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepCircleCompleted: {
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  stepCircleActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  stepCirclePending: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepCircleIcon: {
    fontSize: 15,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  stepSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepCoords: {
    fontSize: 11,
    color: colors.accent,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.border,
    marginLeft: 15,
    marginVertical: 4,
  },
  manifestCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  manifestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manifestTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.accent,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  manifestList: {
    gap: 10,
  },
  manifestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    padding: 10,
  },
  fishIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fishItemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  fishItemSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  qtyBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  qtyText: {
    color: colors.accent,
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyManifestText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
