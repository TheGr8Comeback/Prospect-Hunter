-- Visual data for the demo templates (resorts/hospitality especially).
-- Photos are captured at scrape time from Google Maps, only when a job opts in
-- (params.photos) — bakers never pay for it. Applied MANUALLY.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS photos       text[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hero_image   text;    -- photos[0], the hero shot
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reviews_text text[];  -- real guest quotes for the demo template
