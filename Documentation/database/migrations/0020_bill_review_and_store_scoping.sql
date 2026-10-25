-- Migration: 0020_bill_review_and_store_scoping.sql
-- Description: Add CONFIRMED enum value to BillStatus, add worker_id and store_id to bills, bookings, and workers, enforce duplicate bill protection
-- Traceability: Phase 4 Worker Tablet Portal Enhancements, Store Scoping, and Concurrency Protections
-- Status: APPLIED & VERIFIED on target PostgreSQL database (2026-10-26 UTC)
-- Verification Record: BillStatus has 'CONFIRMED', bills has worker_id (UUID FK), store_id (VARCHAR), bookings has store_id (VARCHAR), workers has store_id (VARCHAR), indexes idx_bills_store_id, idx_bills_worker_id, idx_bills_status, idx_bookings_store_id, idx_workers_store_id, and partial unique indexes uq_bills_processed_bill_number, uq_bills_processed_manual_bill_id

-- 1. Add CONFIRMED to BillStatus enum
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';

-- 2. Add worker_id and store_id to bills table
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);

-- 3. Add store_id to bookings table for explicit persisted store scoping
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);

-- 4. Add store_id to workers table for authoritative worker store scoping
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);

-- 5. Add performance indexes for store filtering and worker review audits
CREATE INDEX IF NOT EXISTS idx_bills_store_id ON public.bills(store_id);
CREATE INDEX IF NOT EXISTS idx_bills_worker_id ON public.bills(worker_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_bookings_store_id ON public.bookings(store_id);
CREATE INDEX IF NOT EXISTS idx_workers_store_id ON public.workers(store_id);

-- 6. Guarantee database-level duplicate bill number prevention for finalized bills
CREATE UNIQUE INDEX IF NOT EXISTS uq_bills_processed_bill_number
  ON public.bills(UPPER(bill_number))
  WHERE status = 'PROCESSED' AND bill_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bills_processed_manual_bill_id
  ON public.bills(UPPER(manual_bill_id))
  WHERE status = 'PROCESSED' AND manual_bill_id IS NOT NULL;
