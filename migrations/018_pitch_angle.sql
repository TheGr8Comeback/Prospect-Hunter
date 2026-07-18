-- Which template angle produced a lead's pitch (e.g. "stat", "outcome").
-- Carried into the export CSV so you can A/B-test angles in Instantly and see
-- which one converts.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pitch_angle text;
