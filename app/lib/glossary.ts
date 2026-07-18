// Central glossary — plain-English explanations for every metric/badge shown in
// the UI. Keep definitions here so they stay consistent everywhere; wrap a
// label with <InfoTip text={GLOSSARY.xxx} />.

export const GLOSSARY = {
  // Qualification
  lead_tier:
    "The qualification verdict. PERFECT = thriving business + clear web gap + reachable. STRONG/MAYBE = weaker. SKIP = not a target.",
  score:
    "Composite score 0-100: overall lead quality (website, socials, reputation, contact). High = a complete, solid lead.",
  warm_score:
    "Sales heat 0-100 (pain × money × intent). High = a prospect with a real need and the means to pay.",
  business_size:
    "Estimated size (review count + name keywords): small / medium / large.",
  disqualified:
    "Automatically ruled out (chain, agency, franchise…): not a relevant target.",
  hooks: "Outreach angles generated automatically from the lead's signals.",

  // Web presence
  no_real_website:
    "The business has no real website (none at all, Facebook page only, or a free builder).",
  fb_checked:
    "We've checked its Facebook page for a real website. Until that's done, a missing site isn't counted as a gap.",
  website_score: "Technical site quality 0-25 (https, mobile, up to date, meta, favicon).",
  mobile_score: "Mobile performance score (Google PageSpeed / Lighthouse) 0-100.",

  // Per-service signals
  seo_score:
    "On-page SEO audit 0-100 (title, meta, H1, canonical, Open Graph, schema, alt…). Low = poorly optimized site → SEO target.",
  has_chat: "The site already has a live-chat widget (Intercom, Drift, Tidio…).",
  chatbot_opportunity:
    "No live chat WHILE reviews show service complaints → chatbot opportunity.",

  // Reputation
  review_pain:
    "Number of complaints detected in customer reviews (delays, service, pricing…).",
  rating: "Average Google rating.",
  reviews_count: "Total number of Google reviews — a proxy for activity / revenue.",

  // Contact
  email_status:
    "Email verification: valid = deliverable, invalid = avoid, mx_valid/unknown = uncertain.",
  email_type: "generic = contact@/info@ (shared inbox) · personal = a named email.",

  // Engagement (personal-site tracking)
  visit_count: "Number of REAL visits (human, engaged) on their personal site.",
  first_engaged_at: "First time a human genuinely interacted with the site (≠ an email scanner).",
  last_opened_at: "Last time the link was opened (may be a human who didn't engage, or a scanner).",
  scanner_count: "Times an email security scanner opened the link (not a real visit).",

  // Sources
  sources: "Where the lead came from: gmaps, osm, yelp, yellowpages, bbb.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
