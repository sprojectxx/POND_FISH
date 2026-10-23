-- Migration: 0019_payments_subscription_id.sql
-- Description: Add subscription_id column to payments table to deterministically link payments to customer subscriptions
-- Traceability: Phase 2 Schema & Replay Integrity Gate; PondFish Database ERD (Section 19.1) & Customer Subscription Engine (Section 12)
-- Status: APPLIED & VERIFIED on target PostgreSQL database (2026-10-23 17:25:42 UTC)
-- Verification Record: column payments.subscription_id (UUID, nullable), index idx_payments_subscription_id, FK payments_subscription_id_fkey

-- 1. Add subscription_id column referencing customer_subscriptions(id)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.customer_subscriptions(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 2. Add performance index on subscription_id for fast replay and relationship lookups
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON public.payments(subscription_id);
