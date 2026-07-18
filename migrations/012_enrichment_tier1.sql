-- Tier-1 enrichment: conversion elements, pitch hooks, real performance,
-- review velocity, and disqualification. All columns added up front so the
-- staged modules (PageSpeed, review velocity, disqualifiers) backfill without
-- further schema changes. Migrations are applied MANUALLY — run this once.

-- #3 Conversion elements (from fetched HTML)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_online_booking boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_click_to_call  boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_contact_form   boolean;

-- Pitch-ammo layer — ranked, quotable outreach angles
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hooks text[];

-- #1 Real performance (Google PageSpeed / Lighthouse)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mobile_score        smallint;  -- 0-100
ALTER TABLE leads ADD COLUMN IF NOT EXISTS perf_score          smallint;  -- 0-100 (desktop)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pagespeed_checked_at timestamptz;

-- #2 Review velocity (recent reviews / month)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_velocity smallint;

-- #5 Disqualification (chains, agency-built, already-excellent)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS disqualified        boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS disqualified_reason text;

-- Recently-opened intent signal
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_recently_opened boolean;
