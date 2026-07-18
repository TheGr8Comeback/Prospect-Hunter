-- Decision maker fields on leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_title text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_email text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_linkedin text;
