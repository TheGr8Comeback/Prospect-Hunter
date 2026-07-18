-- Visit-tracking columns written by the prospect microsites (/api/track).
-- The site's two-phase tracker distinguishes a security-scanner "open" from a
-- real human "engaged" visit, and records email-gateway detonations separately
-- so they never raise a false hot-lead alert. Without these columns the site's
-- has()-guard silently drops the data — this migration keeps the full signal.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_engaged_at timestamptz;      -- first genuine (human) engagement
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_opened_at   timestamptz;      -- last "open" (may be a scanner or a human who didn't engage)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scanner_count    integer NOT NULL DEFAULT 0; -- email security gateway detonations
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_scanned_at  timestamptz;      -- last scanner hit
