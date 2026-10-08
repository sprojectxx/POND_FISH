'use client';

/**
 * ADMIN-17 — Notification Detail & Delivery Logs View
 * Traceability:
 * - PondFish Page-by-Page UI Specification Admin Portal (Section 136 - Notification Details)
 * - PondFish Core Business Engines Specification v1 (Sections 21, 24)
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const TYPE_CONFIG = {
  SYSTEM: { label: 'System Notice', bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: '#475569' },
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
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return val;
  }
}

export default function AdminNotificationDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!id) return;

    async function fetchDetail() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch(`/api/v1/admin/notifications/${id}`);
        const data = await res.json();

        if (data.success && data.notification) {
          setNotification(data.notification);
        } else {
          setErrorMsg(data.error?.message || 'Notification not found.');
        }
      } catch (err) {
        setErrorMsg(err.message || 'Error fetching notification details.');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
        <div style={{ fontSize: '15px' }}>Loading notification details...</div>
      </div>
    );
  }

  if (errorMsg || !notification) {
    return (
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', color: '#F8FAFC' }}>
        <div
          style={{
            padding: '24px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0' }}>Notification Not Found</h2>
          <p style={{ fontSize: '13px', color: '#FCA5A5', marginBottom: '20px' }}>{errorMsg}</p>
          <Link
            id="btn-back-notifications"
            href="/admin/notifications"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#0284C7',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            ← Back to Notifications
          </Link>
        </div>
      </div>
    );
  }

  const typeBadge = TYPE_CONFIG[notification.type] || TYPE_CONFIG.SYSTEM;

  return (
    <div style={{ padding: '24px 32px', color: '#F8FAFC', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Back button & Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          id="btn-back-notifications"
          href="/admin/notifications"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#38BDF8',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: '500',
            marginBottom: '16px',
          }}
        >
          ← Back to Notifications
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
                {notification.title}
              </h1>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: typeBadge.bg,
                  color: typeBadge.text,
                  border: `1px solid ${typeBadge.border}`,
                }}
              >
                {typeBadge.label}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>
              Created: <span style={{ color: '#F8FAFC' }}>{formatDate(notification.createdAt)}</span> • ID:{' '}
              <span style={{ fontFamily: 'monospace', color: '#64748B' }}>{notification.id}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Recipient Details Card */}
        <div
          id="card-recipient-details"
          style={{
            background: '#1E293B',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #334155',
          }}
        >
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#38BDF8', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>👤</span> Recipient Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8' }}>Customer Name:</span>
              <span style={{ fontWeight: '600', color: '#F8FAFC' }}>{notification.customerName || 'Valued Customer'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8' }}>Mobile Number:</span>
              <span style={{ fontWeight: '600', color: '#F8FAFC' }}>{notification.customerPhone || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8' }}>Delivery Area:</span>
              <span style={{ color: '#F8FAFC' }}>{notification.customerArea || 'Standard Service Zone'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8' }}>Customer UUID:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748B' }}>
                {notification.customerId}
              </span>
            </div>
          </div>
        </div>

        {/* Message Content & Read State Card */}
        <div
          id="card-content-details"
          style={{
            background: '#1E293B',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #334155',
          }}
        >
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#38BDF8', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✉️</span> Message Content & Status
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8' }}>In-App Read State:</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: notification.read ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: notification.read ? '#10B981' : '#F59E0B',
                }}
              >
                {notification.read ? 'Read by Customer' : 'Unread in Inbox'}
              </span>
            </div>
            <div>
              <span style={{ display: 'block', color: '#94A3B8', marginBottom: '6px' }}>Message Body:</span>
              <div
                style={{
                  background: '#0F172A',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  lineHeight: '1.5',
                  fontSize: '13px',
                }}
              >
                {notification.message}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Channel Delivery Logs Card */}
      <div
        id="card-deliveries"
        style={{
          background: '#1E293B',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #334155',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🚀</span> Multi-Channel Push Delivery Attempts ({notification.deliveries?.length || 0})
        </h2>

        {(!notification.deliveries || notification.deliveries.length === 0) ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No external push delivery records logged for this notification. Delivered via In-App Bell Channel.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                  <th style={{ padding: '10px 14px' }}>Channel</th>
                  <th style={{ padding: '10px 14px' }}>Delivery Status</th>
                  <th style={{ padding: '10px 14px' }}>Provider Message ID</th>
                  <th style={{ padding: '10px 14px' }}>Sent At</th>
                  <th style={{ padding: '10px 14px' }}>Delivered / Failed At</th>
                  <th style={{ padding: '10px 14px' }}>Error Details</th>
                </tr>
              </thead>
              <tbody>
                {notification.deliveries.map((del) => {
                  const isSent = del.status === 'SENT';
                  const isFailed = del.status === 'FAILED';
                  return (
                    <tr key={del.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#F8FAFC' }}>
                        {del.channel}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: isSent
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isFailed
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                            color: isSent ? '#10B981' : isFailed ? '#EF4444' : '#94A3B8',
                          }}
                        >
                          {del.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#64748B' }}>
                        {del.providerMessageId || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{formatDate(del.sentAt)}</td>
                      <td style={{ padding: '12px 14px', color: '#94A3B8' }}>
                        {formatDate(del.deliveredAt || del.failedAt)}
                      </td>
                      <td style={{ padding: '12px 14px', color: isFailed ? '#EF4444' : '#64748B' }}>
                        {del.errorMessage || 'None'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Administrative Audit Trail Card */}
      <div
        id="card-audit-logs"
        style={{
          background: '#1E293B',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #334155',
        }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📋</span> Administrative Audit Records ({notification.auditLogs?.length || 0})
        </h2>

        {(!notification.auditLogs || notification.auditLogs.length === 0) ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            Event generated via system event trigger (e.g. Booking/Subscription/Order domain event).
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notification.auditLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  background: '#0F172A',
                  borderRadius: '8px',
                  padding: '14px',
                  border: '1px solid #334155',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '700', color: '#38BDF8' }}>{log.action}</span>
                    <span style={{ color: '#94A3B8' }}>by</span>
                    <span style={{ fontWeight: '600', color: '#F8FAFC' }}>
                      {log.actorType}: {log.actorId}
                    </span>
                  </div>
                  <span style={{ color: '#64748B' }}>{formatDate(log.timestamp)}</span>
                </div>
                {log.payload && (
                  <pre
                    style={{
                      background: '#1E293B',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      margin: 0,
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: '#CBD5E1',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
