-- Migration: 0011_gps_journeys_slice11.sql
-- Description: Add origin, destination, fish_manifest, and customer_tracking_closed_at to public.gps_journeys
-- Traceability: Slice 11 — OneLap GPS Truck Tracking & Geofenced Arrival

ALTER TABLE public.gps_journeys
  ADD COLUMN IF NOT EXISTS origin JSONB,
  ADD COLUMN IF NOT EXISTS destination JSONB,
  ADD COLUMN IF NOT EXISTS fish_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_tracking_closed_at TIMESTAMPTZ;
