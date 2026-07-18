-- Email verification status on leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_status text; -- valid, invalid, catch_all, unknown
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dm_email_status text; -- same for decision_maker_email
