-- Migration: 0017_admin_broadcasts_lifecycle.sql
-- Description: Dedicated admin broadcasts and notification lifecycle table
-- Traceability: Admin Portal Specification Sections 131–137 (ADMIN-15 Notification Management)
-- Supports full lifecycle: DRAFT -> SCHEDULED -> SENDING -> SENT / PARTIALLY_FAILED / FAILED / CANCELLED

CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'SYSTEM',
  audience_type VARCHAR(32) NOT NULL DEFAULT 'ALL',
  audience_payload JSONB DEFAULT '{}'::jsonb,
  channels TEXT[] NOT NULL DEFAULT ARRAY['IN_APP', 'PUSH'],
  deep_link TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  recipient_count INTEGER DEFAULT 0,
  push_attempt_count INTEGER DEFAULT 0,
  push_success_count INTEGER DEFAULT 0,
  push_fail_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_status_scheduled 
  ON admin_broadcasts(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_created_at 
  ON admin_broadcasts(created_at DESC);
