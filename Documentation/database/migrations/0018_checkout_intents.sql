-- Migration: 0018_checkout_intents.sql
-- Description: Durable checkout intent and payment attempt tracking for offline/dropped Razorpay webhook recovery
-- Traceability: PondFish Phase 2J-K/L (Durable Checkout Intent Persistence & Audit) & API Spec (Section 31)
-- Status: PROPOSED / UNAPPLIED (Preserves shared database during audit)

CREATE TABLE IF NOT EXISTS checkout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  cart_snapshot JSONB NOT NULL,
  subscription_snapshot JSONB,
  fee_breakdown JSONB NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'PROCESSING', 'PAID', 'COMPLETED', 'FAILED', 'REQUIRES_RECONCILIATION'
  retry_count INTEGER NOT NULL DEFAULT 0,
  booking_id UUID REFERENCES bookings(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_checkout_intents_status CHECK (
    status IN ('CREATED', 'PROCESSING', 'PAID', 'COMPLETED', 'FAILED', 'REQUIRES_RECONCILIATION')
  )
);

CREATE INDEX IF NOT EXISTS idx_checkout_intents_order_id ON checkout_intents(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_customer ON checkout_intents(customer_id);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_status ON checkout_intents(status);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_status_updated ON checkout_intents(status, updated_at);
