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
