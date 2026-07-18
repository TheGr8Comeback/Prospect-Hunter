-- A "no real website" lead is INCONCLUSIVE until we've checked its Facebook
-- page — the real site is very often listed only there. fb_checked records
-- that we fetched the FB page and looked. Until it's true, `no_real_website`
-- is not treated as a structural gap (see scoring/lead-tier.js), so it can't
-- fabricate a PERFECT/STRONG lead.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fb_checked boolean DEFAULT false;
