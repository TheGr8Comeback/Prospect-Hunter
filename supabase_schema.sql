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
