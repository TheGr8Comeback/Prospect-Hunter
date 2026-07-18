-- Decision maker confidence and source tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_confidence text; -- high, medium, low
ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_source text;     -- bbb, website_jsonld, website_regex, gmaps_reviews, yelp, facebook, contact_page, linkedin
