'use client';

/**
 * ADMIN-17 — Notifications Management Console
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 131–137)
 * - PondFish Core Business Engines Specification v1 (Sections 21, 24)
 * - Master PRD v2 (Admin Notification Management)
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const TYPE_CONFIG = {
  SYSTEM: { label: 'System', bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: '#475569' },
  PROMO: { label: 'Promotion', bg: 'rgba(236, 72, 153, 0.15)', text: '#F472B6', border: '#DB2777' },
  ANNOUNCEMENT: { label: 'Announcement', bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: '#9333EA' },
  BOOKING: { label: 'Booking', bg: 'rgba(56, 189, 248, 0.15)', text: '#38BDF8', border: '#0284C7' },
  SUBSCRIPTION: { label: 'Subscription', bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: '#D97706' },
  DELIVERY: { label: 'Delivery / GPS', bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: '#059669' },
};

function formatDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return val;
  }
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    unread: 0,
    booking: 0,
    subscription: 0,
    promo: 0,
    pushSent: 0,
    deliveryFailed: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Composer Modal State
  const [showComposer, setShowComposer] = useState(false);
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerFeedback, setComposerFeedback] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [plans, setPlans] = useState([]);

  const [composerForm, setComposerForm] = useState({
    title: '',
    message: '',
    type: 'SYSTEM',
    audienceType: 'ALL',
    planId: '',
    customerId: '',
    channels: ['IN_APP', 'PUSH'],
    deepLink: '',
  });

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (pageToLoad = pagination.page) => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const params = new URLSearchParams();
        params.set('page', pageToLoad.toString());
        params.set('limit', '20');

        if (search.trim()) params.set('search', search.trim());
        if (typeFilter && typeFilter !== 'ALL') params.set('type', typeFilter);
        if (channelFilter && channelFilter !== 'ALL') params.set('channel', channelFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const res = await fetch(`/api/v1/admin/notifications?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setNotifications(data.notifications || []);
          if (data.counts) setCounts(data.counts);
          if (data.pagination) setPagination(data.pagination);
        } else {
          setErrorMsg(data.error?.message || 'Failed to load notifications.');
        }
      } catch (err) {
        setErrorMsg(err.message || 'Network error fetching notifications.');
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, search, typeFilter, channelFilter, dateFrom, dateTo]
  );

  useEffect(() => {
    fetchNotifications(1);
  }, [typeFilter, channelFilter, dateFrom, dateTo]);

  // Fetch subscription plans for composer target selector
  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await fetch('/api/v1/admin/subscriptions/plans');
        const data = await res.json();
        if (data.success && Array.isArray(data.plans)) {
          setPlans(data.plans);
        }
      } catch {}
    }
    loadPlans();
  }, []);

  // Update audience preview when audience criteria change in composer
  useEffect(() => {
    if (!showComposer) return;

    let isMounted = true;
    async function updatePreview() {
      try {
        setPreviewLoading(true);
        const res = await fetch('/api/v1/admin/notifications/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audienceType: composerForm.audienceType,
            planId: composerForm.planId || null,
            customerId: composerForm.customerId || null,
          }),
        });
        const data = await res.json();
        if (isMounted && data.success) {
          setAudiencePreview(data.preview);
        }
      } catch {
        // Non-blocking preview failure
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    }

    const timer = setTimeout(updatePreview, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [showComposer, composerForm.audienceType, composerForm.planId, composerForm.customerId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchNotifications(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setChannelFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const handleChannelToggle = (channelName) => {
    setComposerForm((prev) => {
      const exists = prev.channels.includes(channelName);
      if (exists) {
        // Prevent unselecting all
        if (prev.channels.length === 1) return prev;
        return { ...prev, channels: prev.channels.filter((c) => c !== channelName) };
      } else {
        return { ...prev, channels: [...prev.channels, channelName] };
      }
    });
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    setComposerFeedback(null);

    if (!composerForm.title.trim()) {
      setComposerFeedback({ type: 'error', text: 'Notification title is required.' });
      return;
    }
    if (!composerForm.message.trim()) {
      setComposerFeedback({ type: 'error', text: 'Notification message body is required.' });
      return;
    }
    if (composerForm.audienceType === 'SPECIFIC_PLAN' && !composerForm.planId) {
      setComposerFeedback({ type: 'error', text: 'Please select a subscription plan.' });
      return;
    }
    if (composerForm.audienceType === 'INDIVIDUAL' && !composerForm.customerId.trim()) {
      setComposerFeedback({ type: 'error', text: 'Please provide a valid Customer UUID.' });
      return;
    }

    try {
      setComposerSubmitting(true);
      const res = await fetch('/api/v1/admin/notifications/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composerForm),
      });

      const data = await res.json();
      if (data.success) {
        setComposerFeedback({
          type: 'success',
          text: `Broadcast sent! Delivered to ${data.result.recipientCount} customer(s). In-App: ${data.result.inAppCount}, Push Attempts: ${data.result.pushAttemptCount} (${data.result.pushSuccessCount} succeeded, ${data.result.pushFailCount} failed/pending).`,
        });
        // Reset form content but keep modal open with feedback
        setComposerForm({
          title: '',
          message: '',
          type: 'SYSTEM',
          audienceType: 'ALL',
          planId: '',
          customerId: '',
          channels: ['IN_APP', 'PUSH'],
          deepLink: '',
        });
        fetchNotifications(1);
      } else {
        setComposerFeedback({
          type: 'error',
          text: data.error?.message || 'Failed to dispatch notification.',
        });
      }
    } catch (err) {
      setComposerFeedback({
        type: 'error',
        text: err.message || 'Network error dispatching notification.',
      });
    } finally {
      setComposerSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', color: '#F8FAFC', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
              🔔 Notifications & Broadcasts
            </h1>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontWeight: '600',
              }}
            >
              ADMIN-17
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px', marginBottom: 0 }}>
            Customer communication hub, push delivery auditing, promotional broadcasts, and domain event logs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            id="btn-refresh-notifications"
            onClick={() => fetchNotifications(pagination.page)}
            disabled={loading}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#1E293B',
              color: '#F8FAFC',
              border: '1px solid #334155',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🔄</span> Refresh
          </button>
          <button
            id="btn-compose-notification"
            onClick={() => {
              setShowComposer(true);
              setComposerFeedback(null);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284C7, #0369A1)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>✍️</span> Compose Notification
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Total Notifications */}
        <div
          id="stat-total-notifications"
          style={{
            background: '#1E293B',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Total Notifications</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#F8FAFC', marginTop: '6px' }}>
            {counts.all.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Authoritative audit trail</div>
        </div>

        {/* Unread */}
        <div
          id="stat-unread-count"
          style={{
            background: '#1E293B',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Unread In-App</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#F59E0B', marginTop: '6px' }}>
            {counts.unread.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: '#F59E0B', marginTop: '4px' }}>Pending customer read</div>
        </div>

        {/* Push Sent */}
        <div
          id="stat-push-sent"
          style={{
            background: '#1E293B',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Push Dispatches</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#38BDF8', marginTop: '6px' }}>
            {counts.pushSent.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: '#38BDF8', marginTop: '4px' }}>Firebase FCM outbound</div>
        </div>

        {/* Delivery Failed */}
        <div
          id="stat-delivery-failed"
          style={{
            background: '#1E293B',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #334155',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Delivery Failures</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: counts.deliveryFailed > 0 ? '#EF4444' : '#10B981', marginTop: '6px' }}>
            {counts.deliveryFailed.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Token or network faults</div>
        </div>

        {/* Category Breakdown Pill */}
        <div
          style={{
            background: '#1E293B',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8', marginBottom: '8px' }}>Category Breakdown</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
            <span style={{ color: '#38BDF8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              📦 Bookings: {counts.booking}
            </span>
            <span style={{ color: '#FBBF24', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              👑 Subs: {counts.subscription}
            </span>
            <span style={{ color: '#F472B6', background: 'rgba(236, 72, 153, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              🏷️ Promo: {counts.promo}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div
        style={{
          background: '#1E293B',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          border: '1px solid #334155',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <input
                id="input-search-notifications"
                type="text"
                placeholder="Search by title, message body, recipient name, phone, or UUID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '13px', opacity: 0.6 }}>
                🔍
              </span>
            </div>

            {/* Type Filter */}
            <div style={{ flex: '0 1 180px' }}>
              <select
                id="select-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Categories</option>
                <option value="SYSTEM">System</option>
                <option value="PROMO">Promotion</option>
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="BOOKING">Booking</option>
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="DELIVERY">Delivery / GPS</option>
              </select>
            </div>

            {/* Channel Filter */}
            <div style={{ flex: '0 1 160px' }}>
              <select
                id="select-channel-filter"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Channels</option>
                <option value="IN_APP">In-App Only</option>
                <option value="PUSH">Push (FCM)</option>
              </select>
            </div>

            {/* Date Range From */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>From:</span>
              <input
                id="input-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Date Range To */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>To:</span>
              <input
                id="input-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Action Buttons */}
            <button
              id="btn-apply-filters"
              type="submit"
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Filter
            </button>
            <button
              id="btn-reset-filters"
              type="button"
              onClick={handleResetFilters}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'transparent',
                color: '#94A3B8',
                border: '1px solid #334155',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            color: '#FCA5A5',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Notifications Table */}
      <div
        style={{
          background: '#1E293B',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            id="table-notifications"
            style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}
          >
            <thead>
              <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                <th id="col-id-date" style={{ padding: '12px 16px', fontWeight: '600' }}>Date & ID</th>
                <th id="col-recipient" style={{ padding: '12px 16px', fontWeight: '600' }}>Recipient</th>
                <th id="col-type" style={{ padding: '12px 16px', fontWeight: '600' }}>Category</th>
                <th id="col-content" style={{ padding: '12px 16px', fontWeight: '600' }}>Message Details</th>
                <th id="col-status" style={{ padding: '12px 16px', fontWeight: '600' }}>Delivery Channels</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
                    <div>Loading notifications...</div>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '56px 20px', textAlign: 'center' }}>
                    <div id="empty-notifications" style={{ maxWidth: '360px', margin: '0 auto' }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#F8FAFC', marginBottom: '6px' }}>
                        No notifications found
                      </div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                        No notifications match the active filter criteria. Adjust filters or compose a new announcement.
                      </div>
                      <button
                        onClick={() => setShowComposer(true)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: '#0284C7',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Compose Notification
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                notifications.map((item) => {
                  const typeBadge = TYPE_CONFIG[item.type] || TYPE_CONFIG.SYSTEM;
                  const pushDeliveries = (item.deliveries || []).filter((d) => d.channel === 'PUSH');
                  const hasPushFailed = pushDeliveries.some((d) => d.status === 'FAILED');
                  const hasPushSent = pushDeliveries.some((d) => d.status === 'SENT');

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #334155',
                        background: 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#0F172A')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Date & ID */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: '500', color: '#F8FAFC', fontSize: '12px' }}>
                          {formatDate(item.createdAt)}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#64748B',
                            fontFamily: 'monospace',
                            marginTop: '2px',
                          }}
                        >
                          {item.id.slice(0, 8)}...
                        </div>
                      </td>

                      {/* Recipient */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: '600', color: '#F8FAFC' }}>
                          {item.customerName || 'Valued Customer'}
                        </div>
                        {item.customerPhone && (
                          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                            📞 {item.customerPhone}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                          ID: {item.customerId?.slice(0, 8)}
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: typeBadge.bg,
                            color: typeBadge.text,
                            border: `1px solid ${typeBadge.border}`,
                          }}
                        >
                          {typeBadge.label}
                        </span>
                      </td>

                      {/* Content */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '380px' }}>
                        <div style={{ fontWeight: '600', color: '#F8FAFC', marginBottom: '2px' }}>
                          {item.title}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#94A3B8',
                            lineHeight: '1.4',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {item.message}
                        </div>
                      </td>

                      {/* Delivery Status */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {/* In-App Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>In-App:</span>
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: item.read ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: item.read ? '#10B981' : '#F59E0B',
                                fontWeight: '500',
                              }}
                            >
                              {item.read ? 'Read' : 'Unread'}
                            </span>
                          </div>

                          {/* Push Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Push:</span>
                            {pushDeliveries.length === 0 ? (
                              <span style={{ fontSize: '11px', color: '#64748B' }}>None</span>
                            ) : hasPushFailed ? (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#EF4444',
                                  fontWeight: '500',
                                }}
                              >
                                Failed
                              </span>
                            ) : hasPushSent ? (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38BDF8',
                                  fontWeight: '500',
                                }}
                              >
                                Sent ({pushDeliveries.length})
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(148, 163, 184, 0.15)',
                                  color: '#94A3B8',
                                  fontWeight: '500',
                                }}
                              >
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                        <Link
                          id={`btn-view-details-${item.id}`}
                          href={`/admin/notifications/${item.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#0F172A',
                            color: '#38BDF8',
                            border: '1px solid #334155',
                            fontSize: '12px',
                            fontWeight: '500',
                            textDecoration: 'none',
                          }}
                        >
                          Details ➔
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div
          id="pagination-controls"
          style={{
            padding: '14px 20px',
            background: '#0F172A',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#94A3B8',
          }}
        >
          <div>
            Showing {(pagination.page - 1) * pagination.limit + (notifications.length > 0 ? 1 : 0)} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} notifications
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              id="btn-prev-page"
              onClick={() => fetchNotifications(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#1E293B',
                color: pagination.page <= 1 ? '#475569' : '#F8FAFC',
                border: '1px solid #334155',
                fontSize: '12px',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ padding: '6px 10px', fontSize: '12px', color: '#F8FAFC' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              id="btn-next-page"
              onClick={() => fetchNotifications(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#1E293B',
                color: pagination.page >= pagination.totalPages ? '#475569' : '#F8FAFC',
                border: '1px solid #334155',
                fontSize: '12px',
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <div
          id="modal-compose-notification"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 17, 32, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#1E293B',
              borderRadius: '16px',
              border: '1px solid #334155',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC', margin: 0 }}>
                  ✍️ Compose & Broadcast Notification
                </h2>
                <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', marginBottom: 0 }}>
                  Targeted messaging with multi-channel push & audit trail.
                </p>
              </div>
              <button
                id="btn-composer-close"
                onClick={() => setShowComposer(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSendNotification} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Feedback Banner */}
              {composerFeedback && (
                <div
                  id="composer-feedback"
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: composerFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${composerFeedback.type === 'success' ? '#10B981' : '#EF4444'}`,
                    color: composerFeedback.type === 'success' ? '#6EE7B7' : '#FCA5A5',
                    fontSize: '13px',
                  }}
                >
                  {composerFeedback.type === 'success' ? '✅' : '⚠️'} {composerFeedback.text}
                </div>
              )}

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
                  Title <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  id="input-notif-title"
                  type="text"
                  placeholder="e.g. Fresh Seer Fish Just Arrived! 🐟"
                  value={composerForm.title}
                  onChange={(e) => setComposerForm({ ...composerForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#0F172A',
                    color: '#F8FAFC',
                    border: '1px solid #334155',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Message Body */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
                  Message Body <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  id="input-notif-message"
                  rows={4}
                  placeholder="Enter notification message text displayed to customers..."
                  value={composerForm.message}
                  onChange={(e) => setComposerForm({ ...composerForm, message: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#0F172A',
                    color: '#F8FAFC',
                    border: '1px solid #334155',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Category & Deep Link Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
                    Category / Type
                  </label>
                  <select
                    id="select-notif-type"
                    value={composerForm.type}
                    onChange={(e) => setComposerForm({ ...composerForm, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#0F172A',
                      color: '#F8FAFC',
                      border: '1px solid #334155',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="SYSTEM">System Notice</option>
                    <option value="PROMO">Promotion / Special Offer</option>
                    <option value="ANNOUNCEMENT">Announcement</option>
                    <option value="DELIVERY">Delivery Update</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
                    Deep Link (Optional App Route)
                  </label>
                  <input
                    id="input-notif-deeplink"
                    type="text"
                    placeholder="e.g. /categories, /subscriptions"
                    value={composerForm.deepLink}
                    onChange={(e) => setComposerForm({ ...composerForm, deepLink: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#0F172A',
                      color: '#F8FAFC',
                      border: '1px solid #334155',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Target Audience Section */}
              <div style={{ background: '#0F172A', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#38BDF8', marginBottom: '8px' }}>
                  🎯 Target Audience
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                  {[
                    { id: 'ALL', label: 'Everyone (All)' },
                    { id: 'ACTIVE_SUBSCRIBERS', label: 'Active Subscribers' },
                    { id: 'SPECIFIC_PLAN', label: 'Specific Plan' },
                    { id: 'INDIVIDUAL', label: 'Individual Customer' },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      id={`btn-audience-${aud.id.toLowerCase()}`}
                      onClick={() => setComposerForm({ ...composerForm, audienceType: aud.id })}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: composerForm.audienceType === aud.id ? '1px solid #38BDF8' : '1px solid #334155',
                        background: composerForm.audienceType === aud.id ? 'rgba(56, 189, 248, 0.15)' : '#1E293B',
                        color: composerForm.audienceType === aud.id ? '#38BDF8' : '#94A3B8',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>

                {/* Specific Plan dropdown if selected */}
                {composerForm.audienceType === 'SPECIFIC_PLAN' && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
                      Select Active Subscription Plan:
                    </label>
                    <select
                      id="select-notif-plan"
                      value={composerForm.planId}
                      onChange={(e) => setComposerForm({ ...composerForm, planId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#1E293B',
                        color: '#F8FAFC',
                        border: '1px solid #334155',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    >
                      <option value="">-- Choose Plan --</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Individual Customer ID input if selected */}
                {composerForm.audienceType === 'INDIVIDUAL' && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
                      Customer UUID:
                    </label>
                    <input
                      id="input-notif-customer-id"
                      type="text"
                      placeholder="e.g. 3a51f89c-0972-4e89-b22f-..."
                      value={composerForm.customerId}
                      onChange={(e) => setComposerForm({ ...composerForm, customerId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#1E293B',
                        color: '#F8FAFC',
                        border: '1px solid #334155',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                )}

                {/* Live Recipient Scope Preview */}
                <div
                  id="preview-recipient-box"
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#1E293B',
                    border: '1px solid #334155',
                    fontSize: '12px',
                    color: '#94A3B8',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#CBD5E1' }}>Estimated Audience Scope:</span>
                    <span style={{ fontWeight: '700', color: '#38BDF8', fontSize: '13px' }}>
                      {previewLoading
                        ? 'Calculating...'
                        : audiencePreview
                        ? `${audiencePreview.estimatedRecipients} recipient(s)`
                        : '0 recipients'}
                    </span>
                  </div>
                  {audiencePreview?.recipientsPreview?.length > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748B' }}>
                      Sample: {audiencePreview.recipientsPreview.slice(0, 3).map((r) => r.name).join(', ')}
                      {audiencePreview.estimatedRecipients > 3 ? '...' : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Channels */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '8px' }}>
                  Delivery Channels
                </label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      id="checkbox-channel-in-app"
                      type="checkbox"
                      checked={composerForm.channels.includes('IN_APP')}
                      onChange={() => handleChannelToggle('IN_APP')}
                    />
                    <span>📲 In-App Notification (Customer Bell)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      id="checkbox-channel-push"
                      type="checkbox"
                      checked={composerForm.channels.includes('PUSH')}
                      onChange={() => handleChannelToggle('PUSH')}
                    />
                    <span>🔔 Push Notification (Firebase FCM)</span>
                  </label>
                </div>
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid #334155',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                }}
              >
                <button
                  id="btn-composer-cancel"
                  type="button"
                  onClick={() => setShowComposer(false)}
                  disabled={composerSubmitting}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    background: '#1E293B',
                    color: '#94A3B8',
                    border: '1px solid #334155',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-composer-send"
                  type="submit"
                  disabled={composerSubmitting || previewLoading}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    background: composerSubmitting ? '#475569' : 'linear-gradient(135deg, #0284C7, #0369A1)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: composerSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {composerSubmitting ? (
                    <>
                      <span>⏳</span> Dispatching...
                    </>
                  ) : (
                    <>
                      <span>🚀</span> Send Broadcast Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
