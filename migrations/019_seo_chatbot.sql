-- Per-service opportunity signals, so a freelance can target + pitch by service.
-- On-page SEO audit (free, from the fetched HTML) and live-chat / chatbot
-- detection. off-page SEO (backlinks/DA) needs a paid API and isn't stored here.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seo_score           smallint;   -- on-page SEO 0-100
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seo_detail          jsonb;      -- per-signal breakdown
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_chat            boolean;    -- an existing chat widget was found
ALTER TABLE leads ADD COLUMN IF NOT EXISTS chat_vendor         text;       -- intercom / drift / tidio…
ALTER TABLE leads ADD COLUMN IF NOT EXISTS chatbot_opportunity boolean;    -- no chat + service pain in reviews
