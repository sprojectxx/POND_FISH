-- Migration: 0020_bill_review_and_store_scoping.sql
-- Description: Add CONFIRMED enum value to BillStatus, add worker_id and store_id to bills table
-- Traceability: Phase 4 Worker Tablet Portal Enhancements & OCR Mutation Boundary Security
-- Status: APPLIED & VERIFIED on target PostgreSQL database (2026-10-26 UTC)
-- Verification Record: BillStatus has 'CONFIRMED', bills has worker_id (UUID FK), store_id (VARCHAR), indexes idx_bills_store_id, idx_bills_worker_id, idx_bills_status

-- 1. Add CONFIRMED to BillStatus enum
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';

-- 2. Add worker_id and store_id to bills table
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);

-- 3. Add performance indexes for store filtering and worker review audits
CREATE INDEX IF NOT EXISTS idx_bills_store_id ON public.bills(store_id);
CREATE INDEX IF NOT EXISTS idx_bills_worker_id ON public.bills(worker_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
