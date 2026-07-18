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
