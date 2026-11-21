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
import { AdminSubNav, AdminPagination, AdminSelect, AdminTableSkeleton } from '@/components/ui';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  SCHEDULED: { label: 'Scheduled', bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  SENDING: { label: 'Sending...', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  SENT: { label: 'Sent', bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  PARTIALLY_FAILED: { label: 'Partially Failed', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  FAILED: { label: 'Failed', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  CANCELLED: { label: 'Cancelled', bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
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
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [broadcastStatusFilter, setBroadcastStatusFilter] = useState('ALL');
  const [broadcastSearch, setBroadcastSearch] = useState('');

  // Customer In-App Notification state
  const [inboxNotifications, setInboxNotifications] = useState([]);
  const [inboxCounts, setInboxCounts] = useState({ all: 0, unread: 0, booking: 0, subscription: 0, promo: 0, pushSent: 0, deliveryFailed: 0 });
  const [inboxPagination, setInboxPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
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
    async (pageToLoad = broadcastPagination.page, limitToLoad = broadcastPagination.limit) => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const currentLimit = limitToLoad || broadcastPagination.limit || 25;
        const params = new URLSearchParams();
        params.set('page', pageToLoad.toString());
        params.set('limit', currentLimit.toString());
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
    [broadcastPagination.page, broadcastPagination.limit, broadcastStatusFilter, broadcastSearch]
  );

  // Fetch customer in-app notifications
  const fetchInboxNotifications = useCallback(
    async (pageToLoad = inboxPagination.page, limitToLoad = inboxPagination.limit) => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const currentLimit = limitToLoad || inboxPagination.limit || 25;
        const params = new URLSearchParams();
        params.set('page', pageToLoad.toString());
        params.set('limit', currentLimit.toString());
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
    [inboxPagination.page, inboxPagination.limit, inboxTypeFilter, inboxSearch]
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
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#0F2C59', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <AdminSubNav
        tabs={[
          { label: 'Customer Directory & Accounts', href: '/admin/customers', exact: true },
          { label: 'Broadcasts & Notifications', href: '/admin/notifications' },
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0, color: '#0F2C59' }}>
            Notifications &amp; Broadcasts
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            id="btn-refresh-notifications"
            onClick={() => (activeTab === 'broadcasts' ? fetchBroadcasts(broadcastPagination.page) : fetchInboxNotifications(inboxPagination.page))}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              background: '#FFFFFF',
              color: '#0F2C59',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg
              className={loading ? 'pf-animate-spin' : ''}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            id="btn-compose-notification"
            onClick={handleOpenComposerNew}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 18px',
              borderRadius: '8px',
              background: '#1E56A0',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Compose Notification</span>
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
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Total Broadcasts</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F2C59', marginTop: '6px' }}>
            {broadcastCounts.total_count}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>All campaigns &amp; drafts</div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Scheduled Queued</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#4338CA', marginTop: '6px' }}>
            {broadcastCounts.scheduled_count}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Awaiting target time</div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Drafts</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#64748B', marginTop: '6px' }}>
            {broadcastCounts.draft_count}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Editable pre-dispatch</div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Successfully Sent</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>
            {broadcastCounts.sent_count}
          </div>
          <div style={{ fontSize: '12px', color: '#065F46', marginTop: '4px', fontWeight: '500' }}>100% delivered</div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Failures / Partial</div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: '800',
              color: broadcastCounts.failed_count + broadcastCounts.partially_failed_count > 0 ? '#DC2626' : '#64748B',
              marginTop: '6px',
            }}
          >
            {broadcastCounts.failed_count + broadcastCounts.partially_failed_count}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            {broadcastCounts.cancelled_count} cancelled
          </div>
        </div>
      </div>

      {/* Success & Error Banners */}
      {successMsg && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {/* View Tabs */}
      <div style={{ display: 'inline-flex', padding: '4px', background: '#F1F5F9', borderRadius: '12px', border: '1px solid #E2E8F0', gap: '4px', marginBottom: '24px' }}>
        <button
          id="tab-broadcasts"
          onClick={() => setActiveTab('broadcasts')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'broadcasts' ? '#1E56A0' : 'transparent',
            color: activeTab === 'broadcasts' ? '#FFFFFF' : '#64748B',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Broadcast Campaigns &amp; Lifecycle ({broadcastCounts.total_count})
        </button>
        <button
          id="tab-inbox"
          onClick={() => setActiveTab('inbox')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'inbox' ? '#1E56A0' : 'transparent',
            color: activeTab === 'inbox' ? '#FFFFFF' : '#64748B',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Customer In-App Inbox Logs ({inboxCounts.all})
        </button>
      </div>

      {/* TAB 1: Broadcasts & Lifecycle Console */}
      {activeTab === 'broadcasts' && (
        <>
          {/* Filters Bar */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: '20px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* Search */}
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748B"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="input-search-broadcasts"
                type="text"
                placeholder="Search campaigns by title, message, or ID..."
                value={broadcastSearch}
                onChange={(e) => setBroadcastSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchBroadcasts(1)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  color: '#0F2C59',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ flex: '0 1 220px' }}>
              <AdminSelect
                id="select-broadcast-status"
                value={broadcastStatusFilter}
                onChange={(val) => setBroadcastStatusFilter(val)}
                options={[
                  { value: 'ALL', label: `All States (${broadcastCounts.total_count})` },
                  { value: 'DRAFT', label: `Drafts (${broadcastCounts.draft_count})` },
                  { value: 'SCHEDULED', label: `Scheduled (${broadcastCounts.scheduled_count})` },
                  { value: 'SENDING', label: `Sending (${broadcastCounts.sending_count})` },
                  { value: 'SENT', label: `Sent (${broadcastCounts.sent_count})` },
                  { value: 'PARTIALLY_FAILED', label: `Partially Failed (${broadcastCounts.partially_failed_count})` },
                  { value: 'FAILED', label: `Failed (${broadcastCounts.failed_count})` },
                  { value: 'CANCELLED', label: `Cancelled (${broadcastCounts.cancelled_count})` },
                ]}
                style={{ width: '100%' }}
              />
            </div>

            <button
              onClick={() => fetchBroadcasts(1)}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#1E56A0',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(30, 86, 160, 0.2)',
                transition: 'all 0.15s ease',
              }}
            >
              Filter
            </button>
          </div>

          {/* Broadcasts Table */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              overflow: 'visible',
              marginBottom: '20px',
              position: 'relative',
              boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)',
            }}
          >
            {/* Top indeterminate loading line */}
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: '#E2E8F0',
                  overflow: 'hidden',
                  zIndex: 10,
                  borderTopLeftRadius: '16px',
                  borderTopRightRadius: '16px',
                }}
              >
                <div
                  className="pf-animate-indeterminate"
                  style={{
                    width: '45%',
                    height: '100%',
                    background: 'linear-gradient(90deg, #1E56A0, #38BDF8, #1E56A0)',
                    borderRadius: '2px',
                  }}
                />
              </div>
            )}

            <div style={{ overflowX: 'auto', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Broadcast Details</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Audience &amp; Channels</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Schedule / Dispatch</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivery Metrics</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <AdminTableSkeleton columns={6} rows={5} />
                  ) : broadcasts.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
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
                            borderBottom: '1px solid #E2E8F0',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Title & Message */}
                          <td style={{ padding: '14px 18px', verticalAlign: 'top', maxWidth: '300px' }}>
                            <div style={{ fontWeight: '700', color: '#0F2C59', marginBottom: '2px' }}>{b.title}</div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#64748B',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                lineHeight: '1.4',
                              }}
                            >
                              {b.message}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', marginTop: '4px' }}>
                              ID: {b.id.slice(0, 8)} • Category: {b.category}
                            </div>
                          </td>

                          {/* Audience & Channels */}
                          <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: '700', color: '#1E56A0', fontSize: '12px' }}>
                              {b.audience_type}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                              {(b.channels || []).join(' + ')}
                            </div>
                          </td>

                          {/* Lifecycle State */}
                          <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '700',
                                letterSpacing: '0.04em',
                                background: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>

                          {/* Schedule / Dispatch Date */}
                          <td style={{ padding: '14px 18px', verticalAlign: 'top', fontSize: '12px' }}>
                            {b.status === 'SCHEDULED' ? (
                              <div>
                                <span style={{ color: '#4338CA', fontWeight: '600' }}>Scheduled for:</span>
                                <div style={{ color: '#0F2C59', marginTop: '2px', fontWeight: '500' }}>{formatDate(b.scheduled_at)}</div>
                              </div>
                            ) : b.sent_at ? (
                              <div>
                                <span style={{ color: '#065F46', fontWeight: '600' }}>Dispatched at:</span>
                                <div style={{ color: '#0F2C59', marginTop: '2px', fontWeight: '500' }}>{formatDate(b.sent_at)}</div>
                              </div>
                            ) : (
                              <span style={{ color: '#64748B' }}>Unscheduled Draft</span>
                            )}
                          </td>

                          {/* Delivery Metrics */}
                          <td style={{ padding: '14px 18px', verticalAlign: 'top', fontSize: '12px' }}>
                            <div>Recipients: <span style={{ color: '#0F2C59', fontWeight: '700' }}>{b.recipient_count || 0}</span></div>
                            {b.push_attempt_count > 0 && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                Push: {b.push_success_count}/{b.push_attempt_count}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 18px', verticalAlign: 'top', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {isEditable ? (
                                <>
                                  <button
                                    onClick={() => handleOpenComposerEdit(b)}
                                    title="Edit unsent draft/scheduled broadcast"
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      background: '#F8FAFC',
                                      color: '#1E56A0',
                                      border: '1px solid #CBD5E1',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleSendNowExisting(b.id)}
                                    title="Dispatch immediately now"
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      background: '#ECFDF5',
                                      color: '#065F46',
                                      border: '1px solid #A7F3D0',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    Send Now
                                  </button>
                                  <button
                                    onClick={() => handleCancelBroadcast(b.id)}
                                    title="Cancel unsent broadcast"
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      background: '#FEF2F2',
                                      color: '#991B1B',
                                      border: '1px solid #FECACA',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
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

            {/* Standardized Broadcast Pagination */}
            <AdminPagination
              page={broadcastPagination.page}
              totalPages={broadcastPagination.totalPages}
              total={broadcastPagination.total}
              limit={broadcastPagination.limit}
              onPageChange={(newPage) => fetchBroadcasts(newPage, broadcastPagination.limit)}
              onLimitChange={(newLimit) => {
                setBroadcastPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
                fetchBroadcasts(1, newLimit);
              }}
              itemName="broadcasts"
              loading={loading}
            />
          </div>
        </>
      )}

      {/* TAB 2: Customer In-App Notification Log */}
      {activeTab === 'inbox' && (
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'visible', position: 'relative', boxShadow: '0 1px 3px rgba(15, 44, 89, 0.05)' }}>
          {/* Top indeterminate loading line */}
          {loading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: '#E2E8F0',
                overflow: 'hidden',
                zIndex: 10,
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
              }}
            >
              <div
                className="pf-animate-indeterminate"
                style={{
                  width: '45%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #1E56A0, #38BDF8, #1E56A0)',
                  borderRadius: '2px',
                }}
              />
            </div>
          )}

          <div style={{ overflowX: 'auto', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recipient</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Title &amp; Content</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Read State</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <AdminTableSkeleton columns={6} rows={5} />
                ) : inboxNotifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                      No in-app notifications found.
                    </td>
                  </tr>
                ) : (
                  inboxNotifications.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '12px' }}>{formatDate(item.createdAt)}</td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '700', color: '#0F2C59' }}>{item.customerName}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>{item.customerPhone}</div>
                      </td>
                      <td style={{ padding: '14px 18px', maxWidth: '350px' }}>
                        <div style={{ fontWeight: '700', color: '#0F2C59', marginBottom: '2px' }}>{item.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>{item.message}</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#1E56A0', border: '1px solid #E2E8F0' }}>
                          {item.type}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {item.read ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '9999px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                            Read
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '9999px', background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }} />
                            Unread
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <Link
                          href={`/admin/notifications/${item.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#1E56A0',
                            fontSize: '12px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: '#F1F5F9',
                            border: '1px solid #CBD5E1',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>Details</span>
                          <span>&rarr;</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Standardized Inbox Pagination */}
          <AdminPagination
            page={inboxPagination.page}
            totalPages={inboxPagination.totalPages}
            total={inboxPagination.total}
            limit={inboxPagination.limit}
            onPageChange={(newPage) => fetchInboxNotifications(newPage, inboxPagination.limit)}
            onLimitChange={(newLimit) => {
              setInboxPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
              fetchInboxNotifications(1, newLimit);
            }}
            itemName="notifications"
            loading={loading}
          />
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
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
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
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0F2C59', margin: 0 }}>
                  {editingBroadcastId ? ' Edit Broadcast Campaign' : 'Compose & Broadcast Notification'}
                </h2>
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', marginBottom: 0 }}>
                  Sections 131–137 • Targeted audience, scheduling, multi-channel push & audit trail.
                </p>
              </div>
              <button
                id="btn-composer-close"
                onClick={() => setShowComposer(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Feedback Banner */}
              {composerFeedback && (
                <div
                  id="composer-feedback"
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: composerFeedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                    border: `1px solid ${composerFeedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                    color: composerFeedback.type === 'success' ? '#065F46' : '#991B1B',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                >
                  {composerFeedback.text}
                </div>
              )}

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#425B73', marginBottom: '6px' }}>
                  Title <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  id="input-notif-title"
                  type="text"
                  placeholder="e.g. Fresh Seer Fish Just Arrived!"
                  value={composerForm.title}
                  onChange={(e) => setComposerForm({ ...composerForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: '#F8FAFC',
                    color: '#0F2C59',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#425B73', marginBottom: '6px' }}>
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
                    background: '#F8FAFC',
                    color: '#0F2C59',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Category & Deep Link */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#425B73', marginBottom: '6px' }}>
                    Category
                  </label>
                  <AdminSelect
                    id="select-notif-type"
                    value={composerForm.category}
                    onChange={(val) => setComposerForm({ ...composerForm, category: val })}
                    options={[
                      { value: 'SYSTEM', label: 'System Notice' },
                      { value: 'PROMO', label: 'Promotion' },
                      { value: 'ANNOUNCEMENT', label: 'Announcement' },
                      { value: 'DELIVERY', label: 'Delivery Update' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#425B73', marginBottom: '6px' }}>
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
                      background: '#F8FAFC',
                      color: '#0F2C59',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Target Audience */}
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1E56A0', marginBottom: '8px' }}>
                  Target Audience
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
                        border: composerForm.audienceType === aud.id ? '1px solid #1E56A0' : '1px solid #CBD5E1',
                        background: composerForm.audienceType === aud.id ? '#1E56A0' : '#FFFFFF',
                        color: composerForm.audienceType === aud.id ? '#FFFFFF' : '#475569',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>

                {composerForm.audienceType === 'SPECIFIC_PLAN' && (
                  <div style={{ marginTop: '8px' }}>
                    <AdminSelect
                      id="select-notif-plan"
                      value={composerForm.planId}
                      onChange={(val) => setComposerForm({ ...composerForm, planId: val })}
                      options={[
                        { value: '', label: '-- Choose Plan --' },
                        ...plans.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                      style={{ width: '100%' }}
                    />
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
                        background: '#FFFFFF',
                        color: '#0F2C59',
                        border: '1px solid #CBD5E1',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box',
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
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: '#64748B' }}>Estimated Audience Scope:</span>
                  <span style={{ color: '#1E56A0', fontWeight: '700' }}>
                    {previewLoading ? 'Calculating...' : `${audiencePreview?.estimatedRecipients || 0} recipient(s)`}
                  </span>
                </div>
              </div>

              {/* Delivery Channels */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#425B73', marginBottom: '6px' }}>
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
                    <span>In-App Notification (Customer Bell)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      id="checkbox-channel-push"
                      type="checkbox"
                      checked={composerForm.channels.includes('PUSH')}
                      onChange={() => handleChannelToggle('PUSH')}
                    />
                    <span>Push Notification (Firebase FCM)</span>
                  </label>
                </div>
              </div>

              {/* Dispatch Mode: Send Now vs Schedule for Later */}
              {!editingBroadcastId && (
                <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#4338CA', marginBottom: '8px' }}>
                    Dispatch Timing
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
                      <span>Send Immediately Now</span>
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
                      <span>Schedule for Later</span>
                    </label>
                  </div>

                  {composerForm.dispatchMode === 'SCHEDULE' && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                        Scheduled Date &amp; Time (IST):
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
                          background: '#FFFFFF',
                          color: '#0F2C59',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px',
                          boxSizing: 'border-box',
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
                  borderTop: '1px solid #E2E8F0',
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
                        padding: '9px 16px',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        color: '#64748B',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Save as Draft
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
                      padding: '9px 16px',
                      borderRadius: '8px',
                      background: '#FFFFFF',
                      color: '#64748B',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
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
                      padding: '9px 20px',
                      borderRadius: '8px',
                      background: '#1E56A0',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: composerSubmitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 6px rgba(30, 86, 160, 0.25)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {composerSubmitting
                      ? 'Processing...'
                      : editingBroadcastId
                      ? 'Save Changes'
                      : composerForm.dispatchMode === 'SCHEDULE'
                      ? 'Schedule Broadcast'
                      : 'Send Broadcast Now'}
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
