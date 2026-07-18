-- Warm lead scoring: pain × money × intent.
-- Inverts the classic composite score — a lead is HOT when it's a successful
-- business (money) with a broken/absent web presence (pain) that is in-market
-- right now (intent). Columns for the ad-spend (#2) and review-mining (#3)
-- modules are added here so those can backfill without a schema change.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS warm_score  smallint;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS warm_detail jsonb;

-- Module #2 — active paid advertising (Facebook Ad Library / Google Ads Transparency)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_active     boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_platforms  text[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_checked_at timestamptz;

-- Module #3 — customer reviews complaining about the site / online booking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_pain    smallint;  -- count of pain-signal reviews
ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_pain_quotes text[];

-- Fast filtering / ordering by warmth in the UI and export scripts
CREATE INDEX IF NOT EXISTS idx_leads_warm_score ON leads (workspace_id, warm_score DESC NULLS LAST);
