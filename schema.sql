-- ============================================================
-- Prospect Hunter — full Supabase schema
-- Paste this file into the Supabase SQL Editor and run it.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Table workspaces ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Workspace par défaut (indispensable pour démarrer)
INSERT INTO workspaces (name) VALUES ('Default') ON CONFLICT DO NOTHING;

-- ── Table leads ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  -- Identité
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  slug          text NOT NULL,
  UNIQUE(workspace_id, slug),

  -- Données scraping
  name          text NOT NULL,
  category      text,           -- clé anglaise : dentist, hvac...
  category_raw  text,
  country       text,
  city          text,
  region        text,
  address       text,
  postal_code   text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  phone         text,
  phone_raw     text,
  website       text,
  has_website   boolean DEFAULT false,
  sources       text[],
  opening_hours text,
  rating        numeric(2,1),
  reviews_count integer,

  -- Enrichissement website (fetch + cheerio)
  https               boolean,
  mobile_friendly     boolean,
  copyright_year      smallint,
  tech_stack          text[],
  html_size_kb        numeric(8,1),
  title_present       boolean,
  meta_desc_present   boolean,
  favicon_present     boolean,
  response_time_ms    integer,
  status_code         smallint,
  website_score       smallint,

  -- Enrichissement socials
  facebook    text,
  instagram   text,
  linkedin    text,
  twitter     text,
  tiktok      text,
  youtube     text,

  -- Enrichissement contact
  email       text,

  -- Enrichissement manuel (à la demande)
  screenshot_url  text,

  -- Intelligence
  score           smallint,
  score_detail    jsonb,

  -- Outreach (géré dans l'UI, jamais touché par le worker)
  subject         text,
  pitch           text,
  pitch_generated text,
  status          text NOT NULL DEFAULT 'draft',
  sent_at         timestamptz,
  notes           text,

  -- Tracking (mis à jour par les sites Netlify)
  visit_count         integer NOT NULL DEFAULT 0,
  first_visited_at    timestamptz,
  last_visited_at     timestamptz,

  -- Meta
  enrichment_status text DEFAULT 'pending',
  enriched_at       timestamptz,
  scraped_at        timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ── Table jobs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  type          text NOT NULL,    -- 'scrape' | 'enrich' | 'screenshot' | 'pitch'
  status        text DEFAULT 'pending', -- pending → running → done | failed
  params        jsonb NOT NULL,   -- { category, city, country, sources[] }
  progress      jsonb,            -- { found: 12, enriched: 8 }
  error         text,
  created_at    timestamptz DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

-- ── Table templates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  subject       text NOT NULL,
  body          text NOT NULL,
  language      text DEFAULT 'en',
  created_at    timestamptz DEFAULT now()
);

-- ── Table email_messages ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  subject       text NOT NULL,
  body          text NOT NULL,
  to_email      text NOT NULL,
  from_email    text NOT NULL,
  status        text DEFAULT 'sent',
  sent_at       timestamptz DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS leads_workspace_id_idx    ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS leads_status_idx          ON leads(status);
CREATE INDEX IF NOT EXISTS leads_category_idx        ON leads(category);
CREATE INDEX IF NOT EXISTS leads_score_idx           ON leads(score DESC);
CREATE INDEX IF NOT EXISTS leads_enrichment_status   ON leads(enrichment_status);
CREATE INDEX IF NOT EXISTS jobs_workspace_status_idx ON jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS jobs_type_idx             ON jobs(type);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security (désactivé pour usage solo) ───────────
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- Activer si tu passes en mode multi-user SaaS.

-- ── Fin ──────────────────────────────────────────────────────
-- Pour vérifier :
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- 004_outreach.sql
-- ============================================================
-- Outreach: email_accounts, campaigns, campaign_leads
-- ============================================================

-- Comptes SMTP multiples
CREATE TABLE IF NOT EXISTS email_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name              text NOT NULL,
  smtp_host         text NOT NULL,
  smtp_port         integer NOT NULL DEFAULT 587,
  smtp_user         text NOT NULL,
  smtp_pass         text NOT NULL,
  sender_name       text NOT NULL,
  sender_email      text NOT NULL,
  daily_limit       integer NOT NULL DEFAULT 300,
  warmup_enabled    boolean NOT NULL DEFAULT true,
  warmup_start_date date,
  sends_today       integer NOT NULL DEFAULT 0,
  last_reset_date   date NOT NULL DEFAULT CURRENT_DATE,
  status            text NOT NULL DEFAULT 'active',
  created_at        timestamptz DEFAULT now()
);

-- Campagnes d'envoi
CREATE TABLE IF NOT EXISTS campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id       uuid REFERENCES templates(id) ON DELETE SET NULL,
  name              text NOT NULL,
  filters           jsonb NOT NULL DEFAULT '{}',
  interval_min      integer NOT NULL DEFAULT 30,
  interval_max      integer NOT NULL DEFAULT 90,
  sending_hour_start integer NOT NULL DEFAULT 9,
  sending_hour_end  integer NOT NULL DEFAULT 18,
  timezone          text NOT NULL DEFAULT 'America/New_York',
  account_ids       uuid[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'draft',
  total_leads       integer NOT NULL DEFAULT 0,
  sent_count        integer NOT NULL DEFAULT 0,
  failed_count      integer NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  started_at        timestamptz,
  paused_at         timestamptz,
  finished_at       timestamptz
);

-- Tracking par lead dans une campagne
CREATE TABLE IF NOT EXISTS campaign_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  account_id    uuid REFERENCES email_accounts(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'pending',
  error         text,
  sent_at       timestamptz,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(campaign_id, lead_id)
);

-- Index pour le worker
CREATE INDEX IF NOT EXISTS idx_campaign_leads_pending
  ON campaign_leads(campaign_id, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_campaigns_running
  ON campaigns(status) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_email_accounts_workspace
  ON email_accounts(workspace_id);

-- Ajout colonnes sur templates
ALTER TABLE templates ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS site_url text;

-- 005_decision_maker.sql
-- Decision maker fields on leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_title text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_email text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_linkedin text;

-- 006_email_verification.sql
-- Email verification status on leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_status text; -- valid, invalid, catch_all, unknown
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_email_status text; -- same for decision_maker_email

-- 007_decision_maker_confidence.sql
-- Decision maker confidence and source tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_confidence text; -- high, medium, low
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_source text;     -- bbb, website_jsonld, website_regex, gmaps_reviews, yelp, facebook, contact_page, linkedin

-- 008_job_retry.sql
-- Job retry support: track attempts and allow automatic retries
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS retry_count   smallint NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_retries   smallint NOT NULL DEFAULT 3;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_error    text;

-- 009_realtime_jobs.sql
-- Enable Realtime on the jobs table so the worker gets notified instantly
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;

-- 010_email_type_business_size.sql
-- Add email_type (personal/generic) and business_size (small/medium/large)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_type text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_size text;

-- Backfill email_type for existing leads with emails
UPDATE leads SET email_type = CASE
  WHEN split_part(email, '@', 1) IN (
    'info', 'contact', 'admin', 'support', 'hello', 'office', 'sales',
    'service', 'help', 'billing', 'enquiries', 'enquiry', 'general',
    'team', 'staff', 'mail', 'email', 'webmaster', 'postmaster',
    'noreply', 'no-reply', 'marketing', 'media', 'press', 'hr',
    'jobs', 'careers', 'feedback', 'complaints', 'reception',
    'frontdesk', 'front-desk', 'customerservice', 'customer-service'
  ) THEN 'generic'
  ELSE 'personal'
END
WHERE email IS NOT NULL AND email_type IS NULL;

-- Backfill business_size for existing leads
UPDATE leads SET business_size = CASE
  WHEN name ~* '\m(group|national|corp|inc|franchise|chain|holdings|enterprises|international|worldwide|global)\M' THEN 'large'
  WHEN reviews_count > 500 THEN 'large'
  WHEN reviews_count > 100 THEN 'medium'
  ELSE 'small'
END
WHERE business_size IS NULL;

-- 011_warm_score.sql
-- Warm lead scoring: pain × money × intent.
-- Inverts the classic composite score — a lead is HOT when it's a successful
-- business (money) with a broken/absent web presence (pain) that is in-market
-- right now (intent). Columns for the ad-spend (#2) and review-mining (#3)
-- modules are added here so those can backfill without a schema change.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS warm_score  smallint;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS warm_detail jsonb;

-- Parked/dead domain, detected from the fetched page (enrichment/website.js).
-- Read by warm-score, lead-tier and hooks to tell "site down" from "site weak".
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_parked boolean;

-- Module #2 — active paid advertising (Facebook Ad Library / Google Ads Transparency)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_active     boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_platforms  text[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_checked_at timestamptz;

-- Module #3 — customer reviews complaining about the site / online booking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_pain    smallint;  -- count of pain-signal reviews
ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_pain_quotes text[];

-- Fast filtering / ordering by warmth in the UI and export scripts
CREATE INDEX IF NOT EXISTS idx_leads_warm_score ON leads (workspace_id, warm_score DESC NULLS LAST);

-- 012_enrichment_tier1.sql
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

-- 013_lead_tier.sql
-- The war-machine layer: structural web-presence type + a clean campaign tier.
-- lead_tier = PERFECT is the cold-email campaign list. Applied MANUALLY.

-- Structural web presence (derived from the URL, no fetch)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS no_real_website boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS free_builder    boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website_kind    text;   -- none | social | free_builder | custom

-- Campaign tier
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_tier   text;       -- PERFECT | STRONG | MAYBE | SKIP
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tier_reason text;

CREATE INDEX IF NOT EXISTS idx_leads_lead_tier ON leads (workspace_id, lead_tier);

-- 014_photos.sql
-- Visual data for the demo templates (resorts/hospitality especially).
-- Photos are captured at scrape time from Google Maps, only when a job opts in
-- (params.photos) — bakers never pay for it. Applied MANUALLY.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS photos       text[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hero_image   text;    -- photos[0], the hero shot
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reviews_text text[];  -- real guest quotes for the demo template

-- 015_fb_check.sql
-- A "no real website" lead is INCONCLUSIVE until we've checked its Facebook
-- page — the real site is very often listed only there. fb_checked records
-- that we fetched the FB page and looked. Until it's true, `no_real_website`
-- is not treated as a structural gap (see scoring/lead-tier.js), so it can't
-- fabricate a PERFECT/STRONG lead.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fb_checked boolean DEFAULT false;

-- 016_drop_decision_maker.sql
-- Remove the decision-maker (owner name) feature entirely. Collecting the name
-- of an individual is personal-data profiling and the main legal/ad-platform
-- risk of the product — dropped in favour of business-only "sales intelligence".
-- The scraper no longer writes any of these; drop the columns so no personal
-- name is ever stored.
ALTER TABLE leads DROP COLUMN IF EXISTS decision_maker_name;
ALTER TABLE leads DROP COLUMN IF EXISTS decision_maker_title;
ALTER TABLE leads DROP COLUMN IF EXISTS decision_maker_email;
ALTER TABLE leads DROP COLUMN IF EXISTS decision_maker_linkedin;
ALTER TABLE leads DROP COLUMN IF EXISTS decision_maker_confidence;
ALTER TABLE leads DROP COLUMN IF EXISTS decision_maker_source;
ALTER TABLE leads DROP COLUMN IF EXISTS dm_email_status;

-- 017_engagement_tracking.sql
-- Visit-tracking columns written by the prospect microsites (/api/track).
-- The site's two-phase tracker distinguishes a security-scanner "open" from a
-- real human "engaged" visit, and records email-gateway detonations separately
-- so they never raise a false hot-lead alert. Without these columns the site's
-- has()-guard silently drops the data — this migration keeps the full signal.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_engaged_at timestamptz;      -- first genuine (human) engagement
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_opened_at   timestamptz;      -- last "open" (may be a scanner or a human who didn't engage)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scanner_count    integer NOT NULL DEFAULT 0; -- email security gateway detonations
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_scanned_at  timestamptz;      -- last scanner hit

-- 018_pitch_angle.sql
-- Which template angle produced a lead's pitch (e.g. "stat", "outcome").
-- Carried into the export CSV so you can A/B-test angles in Instantly and see
-- which one converts.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pitch_angle text;

-- 019_seo_chatbot.sql
-- Per-service opportunity signals, so a freelance can target + pitch by service.
-- On-page SEO audit (free, from the fetched HTML) and live-chat / chatbot
-- detection. off-page SEO (backlinks/DA) needs a paid API and isn't stored here.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seo_score           smallint;   -- on-page SEO 0-100
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seo_detail          jsonb;      -- per-signal breakdown
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_chat            boolean;    -- an existing chat widget was found
ALTER TABLE leads ADD COLUMN IF NOT EXISTS chat_vendor         text;       -- intercom / drift / tidio…
ALTER TABLE leads ADD COLUMN IF NOT EXISTS chatbot_opportunity boolean;    -- no chat + service pain in reviews

-- 020_niche_templates.sql
-- Maps a niche (lead category) to the base URL of its deployed template site.
-- One template per niche → every lead of that category gets its personalized
-- URL (base_url + slug) surfaced in the UI, ready to copy/send.
CREATE TABLE IF NOT EXISTS niche_templates (
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  category     text NOT NULL,
  base_url     text NOT NULL,
  updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, category)
);
