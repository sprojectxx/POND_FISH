-- Migration: 0015_subscription_credit_ledger_adjustment.sql
-- Description: Add ADJUSTMENT to CreditLedgerType enum for manual admin credit adjustments
-- Traceability: Slice 15 — Admin Subscription Management (ADMIN-09 Manual Credit Adjustment)

ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';
