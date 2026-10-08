'use client';

/**
 * ADMIN-15 — Notifications & Broadcast Management Console
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Sections 131–137)
 * - Complete Lifecycle: DRAFT -> SCHEDULED -> SENDING -> SENT / PARTIALLY_FAILED / FAILED / CANCELLED
 * - Pre-dispatch Edit & Cancel, Immediate Send Now, and Scheduled Processor
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: '#475569' },
  SCHEDULED: { label: 'Scheduled', bg: 'rgba(99, 102, 241, 0.15)', text: '#818CF8', border: '#4F46E5' },
  SENDING: { label: 'Sending...', bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: '#D97706' },
  SENT: { label: 'Sent', bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: '#059669' },
  PARTIALLY_FAILED: { label: 'Partially Failed', bg: 'rgba(249, 115, 22, 0.15)', text: '#FB923C', border: '#EA580C' },
  FAILED: { label: 'Failed', bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: '#DC2626' },
  CANCELLED: { label: 'Cancelled', bg: 'rgba(100, 116, 139, 0.2)', text: '#64748B', border: '#334155' },
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
  const [activeTab, setActiveTab] = useState('broadcasts'); // 'broadcasts' | 'inbox'

  // Broadcasts state
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastCounts, setBroadcastCounts] = useState({
    total_count: 0,
    draft_count: 0,
    scheduled_count: 0,
    sending_count: 0,
    sent_count: 0,
    partially_failed_count: 0,
    failed_count: 0,
    cancelled_count: 0,
  });
  const [broadcastPagination, setBroadcastPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [broadcastStatusFilter, setBroadcastStatusFilter] = useState('ALL');
  const [broadcastSearch, setBroadcastSearch] = useState('');

  // Customer In-App Notification state
  const [inboxNotifications, setInboxNotifications] = useState([]);
  const [inboxCounts, setInboxCounts] = useState({ all: 0, unread: 0, booking: 0, subscription: 0, promo: 0, pushSent: 0, deliveryFailed: 0 });
  const [inboxPagination, setInboxPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxTypeFilter, setInboxTypeFilter] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Composer Modal State
  const [showComposer, setShowComposer] = useState(false);
  const [editingBroadcastId, setEditingBroadcastId] = useState(null);
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerFeedback, setComposerFeedback] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [plans, setPlans] = useState([]);

  // Composer form fields
  const [composerForm, setComposerForm] = useState({
    title: '',
    message: '',
    category: 'SYSTEM',
    audienceType: 'ALL',
    planId: '',
    customerId: '',
    channels: ['IN_APP', 'PUSH'],
    deepLink: '',
    dispatchMode: 'NOW', // 'NOW' | 'SCHEDULE' | 'DRAFT'
    scheduledAt: '',
  });

  // Fetch broadcasts
  const fetchBroadcasts = useCallback(
    async (pageToLoad = broadcastPagination.page) => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const params = new URLSearchParams();
        params.set('page', pageToLoad.toString());
        params.set('limit', '20');
        if (broadcastStatusFilter && broadcastStatusFilter !== 'ALL') {
          params.set('status', broadcastStatusFilter);
        }
        if (broadcastSearch.trim()) {
          params.set('search', broadcastSearch.trim());
        }

        const res = await fetch(`/api/v1/admin/notifications/broadcasts?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setBroadcasts(data.broadcasts || []);
          if (data.counts) setBroadcastCounts(data.counts);
          if (data.pagination) setBroadcastPagination(data.pagination);
        } else {
          setErrorMsg(data.error?.message || 'Failed to load broadcasts.');
        }
      } catch (err) {
        setErrorMsg(err.message || 'Network error fetching broadcasts.');
      } finally {
        setLoading(false);
      }
    },
    [broadcastPagination.page, broadcastStatusFilter, broadcastSearch]
  );

  // Fetch customer in-app notifications
  const fetchInboxNotifications = useCallback(
    async (pageToLoad = inboxPagination.page) => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const params = new URLSearchParams();
        params.set('page', pageToLoad.toString());
        params.set('limit', '20');
        if (inboxTypeFilter && inboxTypeFilter !== 'ALL') {
          params.set('type', inboxTypeFilter);
        }
        if (inboxSearch.trim()) {
          params.set('search', inboxSearch.trim());
        }

        const res = await fetch(`/api/v1/admin/notifications?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setInboxNotifications(data.notifications || []);
          if (data.counts) setInboxCounts(data.counts);
          if (data.pagination) setInboxPagination(data.pagination);
        } else {
          setErrorMsg(data.error?.message || 'Failed to load customer notifications.');
        }
      } catch (err) {
        setErrorMsg(err.message || 'Network error fetching customer notifications.');
      } finally {
        setLoading(false);
      }
    },
    [inboxPagination.page, inboxTypeFilter, inboxSearch]
  );

  useEffect(() => {
    if (activeTab === 'broadcasts') {
      fetchBroadcasts(1);
    } else {
      fetchInboxNotifications(1);
    }
  }, [activeTab, broadcastStatusFilter, inboxTypeFilter]);

  // Load plans for target dropdown
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

  // Recipient scope preview in composer
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
      } catch {}
      finally {
        if (isMounted) setPreviewLoading(false);
      }
    }

    const timer = setTimeout(updatePreview, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [showComposer, composerForm.audienceType, composerForm.planId, composerForm.customerId]);

  const handleOpenComposerNew = () => {
    setEditingBroadcastId(null);
    setComposerForm({
      title: '',
      message: '',
      category: 'SYSTEM',
      audienceType: 'ALL',
      planId: '',
      customerId: '',
      channels: ['IN_APP', 'PUSH'],
      deepLink: '',
      dispatchMode: 'NOW',
      scheduledAt: '',
    });
    setComposerFeedback(null);
    setShowComposer(true);
  };

  const handleOpenComposerEdit = (item) => {
    if (!['DRAFT', 'SCHEDULED'].includes(item.status)) return;
    setEditingBroadcastId(item.id);
    const audiencePayload = typeof item.audience_payload === 'string'
      ? JSON.parse(item.audience_payload || '{}')
      : (item.audience_payload || {});

    setComposerForm({
      title: item.title || '',
      message: item.message || '',
      category: item.category || 'SYSTEM',
      audienceType: item.audience_type || 'ALL',
      planId: audiencePayload.planId || '',
      customerId: audiencePayload.customerId || '',
      channels: item.channels || ['IN_APP', 'PUSH'],
      deepLink: item.deep_link || '',
      dispatchMode: item.status === 'SCHEDULED' ? 'SCHEDULE' : 'DRAFT',
      scheduledAt: item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '',
    });
    setComposerFeedback(null);
    setShowComposer(true);
  };

  const handleCancelBroadcast = async (broadcastId) => {
    if (!confirm('Are you sure you want to cancel this unsent broadcast? Cancelled broadcasts will never be dispatched.')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/admin/notifications/broadcasts/${broadcastId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Broadcast cancelled successfully.');
        fetchBroadcasts(broadcastPagination.page);
      } else {
        setErrorMsg(data.error?.message || 'Failed to cancel broadcast.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error cancelling broadcast.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNowExisting = async (broadcastId) => {
    if (!confirm('Send this broadcast now to its target audience?')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/admin/notifications/broadcasts/${broadcastId}/dispatch`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Broadcast dispatched! Recipient reach: ${data.result.recipientCount}. Status: ${data.result.status}.`);
        fetchBroadcasts(1);
      } else {
        setErrorMsg(data.error?.message || 'Failed to dispatch broadcast.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error dispatching broadcast.');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelToggle = (channelName) => {
    setComposerForm((prev) => {
      const exists = prev.channels.includes(channelName);
      if (exists) {
        if (prev.channels.length === 1) return prev;
        return { ...prev, channels: prev.channels.filter((c) => c !== channelName) };
      } else {
        return { ...prev, channels: [...prev.channels, channelName] };
      }
    });
  };

  const handleComposerSubmit = async (modeOverride = null) => {
    setComposerFeedback(null);
    const targetMode = modeOverride || composerForm.dispatchMode;

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
    if (targetMode === 'SCHEDULE' && !composerForm.scheduledAt) {
      setComposerFeedback({ type: 'error', text: 'Please provide a future scheduled date and time.' });
      return;
    }

    try {
      setComposerSubmitting(true);

      // Editing existing broadcast
      if (editingBroadcastId) {
        const payload = {
          title: composerForm.title,
          message: composerForm.message,
          category: composerForm.category,
          audienceType: composerForm.audienceType,
          audiencePayload: { planId: composerForm.planId || null, customerId: composerForm.customerId || null },
          channels: composerForm.channels,
          deepLink: composerForm.deepLink || null,
          scheduledAt: targetMode === 'SCHEDULE' ? composerForm.scheduledAt : null,
        };

        const res = await fetch(`/api/v1/admin/notifications/broadcasts/${editingBroadcastId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          setShowComposer(false);
          setSuccessMsg('Broadcast updated successfully.');
          fetchBroadcasts(broadcastPagination.page);
        } else {
          setComposerFeedback({ type: 'error', text: data.error?.message || 'Failed to update broadcast.' });
        }
        return;
      }

      // New Broadcast Creation
      if (targetMode === 'NOW') {
        const res = await fetch('/api/v1/admin/notifications/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: composerForm.title,
            message: composerForm.message,
            category: composerForm.category,
            audienceType: composerForm.audienceType,
            planId: composerForm.planId || null,
            customerId: composerForm.customerId || null,
            channels: composerForm.channels,
            deepLink: composerForm.deepLink || null,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setShowComposer(false);
          setSuccessMsg(`Broadcast sent immediately to ${data.result.recipientCount} customer(s). Status: ${data.result.broadcast?.status || 'SENT'}.`);
          fetchBroadcasts(1);
        } else {
          setComposerFeedback({ type: 'error', text: data.error?.message || 'Failed to dispatch broadcast.' });
        }
      } else {
        // Save as DRAFT or SCHEDULE
        const res = await fetch('/api/v1/admin/notifications/broadcasts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: composerForm.title,
            message: composerForm.message,
            category: composerForm.category,
            audienceType: composerForm.audienceType,
            planId: composerForm.planId || null,
            customerId: composerForm.customerId || null,
            channels: composerForm.channels,
            deepLink: composerForm.deepLink || null,
            status: targetMode === 'SCHEDULE' ? 'SCHEDULED' : 'DRAFT',
            scheduledAt: targetMode === 'SCHEDULE' ? composerForm.scheduledAt : null,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setShowComposer(false);
          setSuccessMsg(targetMode === 'SCHEDULE' ? 'Broadcast scheduled successfully.' : 'Draft saved successfully.');
          fetchBroadcasts(1);
        } else {
          setComposerFeedback({ type: 'error', text: data.error?.message || 'Failed to save broadcast.' });
        }
      }
    } catch (err) {
      setComposerFeedback({ type: 'error', text: err.message || 'Error submitting broadcast.' });
    } finally {
      setComposerSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', color: '#F8FAFC', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
              🔔 Notifications & Broadcast Management
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
              ADMIN-15 / Sections 131–137
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px', marginBottom: 0 }}>
            Complete lifecycle management: Drafts, scheduling, pre-dispatch edits & cancellations, push tracking, and delivery auditing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            id="btn-refresh-notifications"
            onClick={() => (activeTab === 'broadcasts' ? fetchBroadcasts(broadcastPagination.page) : fetchInboxNotifications(inboxPagination.page))}
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
            onClick={handleOpenComposerNew}
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

      {/* KPI Metric Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ background: '#1E293B', borderRadius: '12px', padding: '16px 20px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Total Broadcasts</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#F8FAFC', marginTop: '6px' }}>
            {broadcastCounts.total_count}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>All campaigns & drafts</div>
        </div>

        <div style={{ background: '#1E293B', borderRadius: '12px', padding: '16px 20px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Scheduled Queued</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#818CF8', marginTop: '6px' }}>
            {broadcastCounts.scheduled_count}
          </div>
          <div style={{ fontSize: '11px', color: '#818CF8', marginTop: '4px' }}>Awaiting target time</div>
        </div>

        <div style={{ background: '#1E293B', borderRadius: '12px', padding: '16px 20px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Drafts</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#94A3B8', marginTop: '6px' }}>
            {broadcastCounts.draft_count}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Editable pre-dispatch</div>
        </div>

        <div style={{ background: '#1E293B', borderRadius: '12px', padding: '16px 20px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Successfully Sent</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#34D399', marginTop: '6px' }}>
            {broadcastCounts.sent_count}
          </div>
          <div style={{ fontSize: '11px', color: '#34D399', marginTop: '4px' }}>100% delivered</div>
        </div>

        <div style={{ background: '#1E293B', borderRadius: '12px', padding: '16px 20px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8' }}>Failures / Partial</div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: broadcastCounts.failed_count + broadcastCounts.partially_failed_count > 0 ? '#F87171' : '#64748B',
              marginTop: '6px',
            }}
          >
            {broadcastCounts.failed_count + broadcastCounts.partially_failed_count}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            {broadcastCounts.cancelled_count} cancelled
          </div>
        </div>
      </div>

      {/* Success & Error Banners */}
      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10B981',
            color: '#6EE7B7',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#6EE7B7', cursor: 'pointer' }}>✕</button>
        </div>
      )}

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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', marginBottom: '20px' }}>
        <button
          id="tab-broadcasts"
          onClick={() => setActiveTab('broadcasts')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'broadcasts' ? '2px solid #38BDF8' : '2px solid transparent',
            color: activeTab === 'broadcasts' ? '#38BDF8' : '#94A3B8',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          📢 Broadcast Campaigns & Lifecycle ({broadcastCounts.total_count})
        </button>
        <button
          id="tab-inbox"
          onClick={() => setActiveTab('inbox')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'inbox' ? '2px solid #38BDF8' : '2px solid transparent',
            color: activeTab === 'inbox' ? '#38BDF8' : '#94A3B8',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          📬 Customer In-App Inbox Logs ({inboxCounts.all})
        </button>
      </div>

      {/* TAB 1: Broadcasts & Lifecycle Console */}
      {activeTab === 'broadcasts' && (
        <>
          {/* Filters Bar */}
          <div
            style={{
              background: '#1E293B',
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: '20px',
              border: '1px solid #334155',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* Search */}
            <div style={{ flex: '1 1 240px' }}>
              <input
                id="input-search-broadcasts"
                type="text"
                placeholder="Search campaigns by title, message, or ID..."
                value={broadcastSearch}
                onChange={(e) => setBroadcastSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchBroadcasts(1)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ flex: '0 1 180px' }}>
              <select
                id="select-broadcast-status"
                value={broadcastStatusFilter}
                onChange={(e) => setBroadcastStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #334155',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All States ({broadcastCounts.total_count})</option>
                <option value="DRAFT">Drafts ({broadcastCounts.draft_count})</option>
                <option value="SCHEDULED">Scheduled ({broadcastCounts.scheduled_count})</option>
                <option value="SENDING">Sending ({broadcastCounts.sending_count})</option>
                <option value="SENT">Sent ({broadcastCounts.sent_count})</option>
                <option value="PARTIALLY_FAILED">Partially Failed ({broadcastCounts.partially_failed_count})</option>
                <option value="FAILED">Failed ({broadcastCounts.failed_count})</option>
                <option value="CANCELLED">Cancelled ({broadcastCounts.cancelled_count})</option>
              </select>
            </div>

            <button
              onClick={() => fetchBroadcasts(1)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
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
          </div>

          {/* Broadcasts Table */}
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
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Broadcast Details</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Audience & Channels</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Lifecycle State</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Schedule / Dispatch</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600' }}>Delivery Metrics</th>
                    <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                        Loading campaigns...
                      </td>
                    </tr>
                  ) : broadcasts.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                        No broadcasts found in this status. Click "Compose Notification" to create a draft or campaign.
                      </td>
                    </tr>
                  ) : (
                    broadcasts.map((b) => {
                      const badge = STATUS_CONFIG[b.status] || STATUS_CONFIG.DRAFT;
                      const isEditable = ['DRAFT', 'SCHEDULED'].includes(b.status);

                      return (
                        <tr
                          key={b.id}
                          style={{
                            borderBottom: '1px solid #334155',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#0F172A')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Title & Message */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '300px' }}>
                            <div style={{ fontWeight: '600', color: '#F8FAFC', marginBottom: '2px' }}>{b.title}</div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#94A3B8',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {b.message}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace', marginTop: '4px' }}>
                              ID: {b.id.slice(0, 8)}... • Category: {b.category}
                            </div>
                          </td>

                          {/* Audience & Channels */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: '600', color: '#38BDF8', fontSize: '12px' }}>
                              {b.audience_type}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                              {(b.channels || []).join(' + ')}
                            </div>
                          </td>

                          {/* Lifecycle State */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>

                          {/* Schedule / Dispatch Date */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'top', fontSize: '12px' }}>
                            {b.status === 'SCHEDULED' ? (
                              <div>
                                <span style={{ color: '#818CF8', fontWeight: '500' }}>⏰ Scheduled for:</span>
                                <div style={{ color: '#F8FAFC', marginTop: '2px' }}>{formatDate(b.scheduled_at)}</div>
                              </div>
                            ) : b.sent_at ? (
                              <div>
                                <span style={{ color: '#34D399', fontWeight: '500' }}>🚀 Dispatched at:</span>
                                <div style={{ color: '#F8FAFC', marginTop: '2px' }}>{formatDate(b.sent_at)}</div>
                              </div>
                            ) : (
                              <span style={{ color: '#64748B' }}>Unscheduled Draft</span>
                            )}
                          </td>

                          {/* Delivery Metrics */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'top', fontSize: '12px' }}>
                            <div>Recipients: <span style={{ color: '#F8FAFC', fontWeight: '600' }}>{b.recipient_count || 0}</span></div>
                            {b.push_attempt_count > 0 && (
                              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                                Push: {b.push_success_count}/{b.push_attempt_count}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {isEditable ? (
                                <>
                                  <button
                                    onClick={() => handleOpenComposerEdit(b)}
                                    title="Edit unsent draft/scheduled broadcast"
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: '#0F172A',
                                      color: '#38BDF8',
                                      border: '1px solid #334155',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    onClick={() => handleSendNowExisting(b.id)}
                                    title="Dispatch immediately now"
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#34D399',
                                      border: '1px solid #059669',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🚀 Send Now
                                  </button>
                                  <button
                                    onClick={() => handleCancelBroadcast(b.id)}
                                    title="Cancel unsent broadcast"
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      color: '#F87171',
                                      border: '1px solid #DC2626',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✕ Cancel
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
                                  Immutable
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Broadcast Pagination */}
            <div
              style={{
                padding: '12px 18px',
                background: '#0F172A',
                borderTop: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: '#94A3B8',
              }}
            >
              <div>
                Showing Page {broadcastPagination.page} of {broadcastPagination.totalPages} ({broadcastPagination.total} total)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => fetchBroadcasts(broadcastPagination.page - 1)}
                  disabled={broadcastPagination.page <= 1 || loading}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    background: '#1E293B',
                    color: '#F8FAFC',
                    border: '1px solid #334155',
                    cursor: broadcastPagination.page <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Prev
                </button>
                <button
                  onClick={() => fetchBroadcasts(broadcastPagination.page + 1)}
                  disabled={broadcastPagination.page >= broadcastPagination.totalPages || loading}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    background: '#1E293B',
                    color: '#F8FAFC',
                    border: '1px solid #334155',
                    cursor: broadcastPagination.page >= broadcastPagination.totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: Customer In-App Notification Log */}
      {activeTab === 'inbox' && (
        <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Recipient</th>
                  <th style={{ padding: '12px 16px' }}>Title & Content</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Read State</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inboxNotifications.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>{formatDate(item.createdAt)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#F8FAFC' }}>{item.customerName}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{item.customerPhone}</div>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '350px' }}>
                      <div style={{ fontWeight: '600', color: '#F8FAFC' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: '#94A3B8' }}>{item.message}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#0F172A', color: '#38BDF8' }}>
                        {item.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', color: item.read ? '#34D399' : '#FBBF24' }}>
                        {item.read ? 'Read' : 'Unread'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Link
                        href={`/admin/notifications/${item.id}`}
                        style={{ color: '#38BDF8', fontSize: '12px', textDecoration: 'none' }}
                      >
                        Details ➔
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC', margin: 0 }}>
                  {editingBroadcastId ? '✏️ Edit Broadcast Campaign' : '✍️ Compose & Broadcast Notification'}
                </h2>
                <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', marginBottom: 0 }}>
                  Sections 131–137 • Targeted audience, scheduling, multi-channel push & audit trail.
                </p>
              </div>
              <button
                id="btn-composer-close"
                onClick={() => setShowComposer(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Feedback Banner */}
              {composerFeedback && (
                <div
                  id="composer-feedback"
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: composerFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${composerFeedback.type === 'success' ? '#10B981' : '#EF4444'}`,
                    color: composerFeedback.type === 'success' ? '#6EE7B7' : '#FCA5A5',
                    fontSize: '13px',
                  }}
                >
                  {composerFeedback.text}
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
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: '#0F172A',
                    color: '#F8FAFC',
                    border: '1px solid #334155',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
                  Message Body <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  id="input-notif-message"
                  rows={3}
                  placeholder="Enter notification message text..."
                  value={composerForm.message}
                  onChange={(e) => setComposerForm({ ...composerForm, message: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
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

              {/* Category & Deep Link */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    id="select-notif-type"
                    value={composerForm.category}
                    onChange={(e) => setComposerForm({ ...composerForm, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      background: '#0F172A',
                      color: '#F8FAFC',
                      border: '1px solid #334155',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  >
                    <option value="SYSTEM">System Notice</option>
                    <option value="PROMO">Promotion</option>
                    <option value="ANNOUNCEMENT">Announcement</option>
                    <option value="DELIVERY">Delivery Update</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
                    Optional Deep Link
                  </label>
                  <input
                    id="input-notif-deeplink"
                    type="text"
                    placeholder="e.g. /categories, /subscriptions"
                    value={composerForm.deepLink}
                    onChange={(e) => setComposerForm({ ...composerForm, deepLink: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
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

              {/* Target Audience */}
              <div style={{ background: '#0F172A', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#38BDF8', marginBottom: '8px' }}>
                  🎯 Target Audience
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px' }}>
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
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: composerForm.audienceType === aud.id ? '1px solid #38BDF8' : '1px solid #334155',
                        background: composerForm.audienceType === aud.id ? 'rgba(56, 189, 248, 0.15)' : '#1E293B',
                        color: composerForm.audienceType === aud.id ? '#38BDF8' : '#94A3B8',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>

                {composerForm.audienceType === 'SPECIFIC_PLAN' && (
                  <div style={{ marginTop: '8px' }}>
                    <select
                      id="select-notif-plan"
                      value={composerForm.planId}
                      onChange={(e) => setComposerForm({ ...composerForm, planId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: '#1E293B',
                        color: '#F8FAFC',
                        border: '1px solid #334155',
                        fontSize: '12px',
                      }}
                    >
                      <option value="">-- Choose Plan --</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {composerForm.audienceType === 'INDIVIDUAL' && (
                  <div style={{ marginTop: '8px' }}>
                    <input
                      id="input-notif-customer-id"
                      type="text"
                      placeholder="Customer UUID..."
                      value={composerForm.customerId}
                      onChange={(e) => setComposerForm({ ...composerForm, customerId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: '#1E293B',
                        color: '#F8FAFC',
                        border: '1px solid #334155',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                )}

                {/* Scope Preview */}
                <div
                  id="preview-recipient-box"
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#1E293B',
                    border: '1px solid #334155',
                    fontSize: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: '#94A3B8' }}>Estimated Audience Scope:</span>
                  <span style={{ color: '#38BDF8', fontWeight: '700' }}>
                    {previewLoading ? 'Calculating...' : `${audiencePreview?.estimatedRecipients || 0} recipient(s)`}
                  </span>
                </div>
              </div>

              {/* Delivery Channels */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
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

              {/* Dispatch Mode: Send Now vs Schedule for Later */}
              {!editingBroadcastId && (
                <div style={{ background: '#0F172A', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#818CF8', marginBottom: '8px' }}>
                    ⏰ Dispatch Timing
                  </label>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="radio"
                        name="dispatchMode"
                        value="NOW"
                        checked={composerForm.dispatchMode === 'NOW'}
                        onChange={() => setComposerForm({ ...composerForm, dispatchMode: 'NOW' })}
                      />
                      <span>🚀 Send Immediately Now</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        id="radio-schedule-later"
                        type="radio"
                        name="dispatchMode"
                        value="SCHEDULE"
                        checked={composerForm.dispatchMode === 'SCHEDULE'}
                        onChange={() => setComposerForm({ ...composerForm, dispatchMode: 'SCHEDULE' })}
                      />
                      <span>⏰ Schedule for Later</span>
                    </label>
                  </div>

                  {composerForm.dispatchMode === 'SCHEDULE' && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
                        Scheduled Date & Time (IST):
                      </label>
                      <input
                        id="input-scheduled-time"
                        type="datetime-local"
                        min={new Date().toISOString().slice(0, 16)}
                        value={composerForm.scheduledAt}
                        onChange={(e) => setComposerForm({ ...composerForm, scheduledAt: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: '#1E293B',
                          color: '#F8FAFC',
                          border: '1px solid #334155',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Actions Footer */}
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '16px',
                  borderTop: '1px solid #334155',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  {!editingBroadcastId && (
                    <button
                      id="btn-save-draft"
                      type="button"
                      disabled={composerSubmitting}
                      onClick={() => handleComposerSubmit('DRAFT')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        background: '#0F172A',
                        color: '#94A3B8',
                        border: '1px solid #334155',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      💾 Save as Draft
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    id="btn-composer-cancel"
                    type="button"
                    onClick={() => setShowComposer(false)}
                    disabled={composerSubmitting}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: 'transparent',
                      color: '#94A3B8',
                      border: '1px solid #334155',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    id="btn-composer-send"
                    type="button"
                    disabled={composerSubmitting || previewLoading}
                    onClick={() => handleComposerSubmit()}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      background: composerForm.dispatchMode === 'SCHEDULE'
                        ? 'linear-gradient(135deg, #4F46E5, #4338CA)'
                        : 'linear-gradient(135deg, #0284C7, #0369A1)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: composerSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {composerSubmitting
                      ? 'Processing...'
                      : editingBroadcastId
                      ? 'Save Changes'
                      : composerForm.dispatchMode === 'SCHEDULE'
                      ? '⏰ Schedule Broadcast'
                      : '🚀 Send Broadcast Now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
