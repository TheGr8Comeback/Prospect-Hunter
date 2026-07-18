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
