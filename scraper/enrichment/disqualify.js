// Disqualification (Tier-1 #5) — flag leads NOT worth outreach so they stop
// polluting the warm list and wasting sends:
//   • chains / franchises  → web handled by corporate, a solo can't sell them
//   • agency-built sites   → they already pay a provider; hard to displace
//
// Flags (does not delete) so you can still audit. Returns the first reason hit.
//
// NOTE: there used to be an "already-excellent" rule here (disqualify if
// website_score >= 22 + fast mobile). Dropped it — that score is purely
// structural (HTTPS, mobile-friendly, meta tags...) and has zero signal on
// actual design quality. A site can max out every technical box and still
// look amateurish; auto-disqualifying on that basis silently eliminated
// exactly the "ugly but technically fine" leads that make good prospects.
// Better to under-flag than to wrongly drop a promising lead.

// Known franchise / national brands (web is centralized — not a solo's client).
const FRANCHISE = /\b(mcdonald|burger king|subway|domino'?s|kfc|starbucks|dunkin|h&r block|jiffy lube|midas|meineke|aamco|servpro|servicemaster|molly maid|merry maids|the ups store|ace hardware|century ?21|re\/max|keller williams|coldwell banker|anytime fitness|planet fitness|orangetheory|great clips|supercuts|sport clips|European wax|massage envy|batteries plus|matco|snap-on)\b/i;

// Footer credit pointing to an agency/freelancer (NOT a DIY platform, which is
// a good prospect). Platform "powered by" strings are deliberately excluded.
const AGENCY_CREDIT =
  /(?:website|site|design(?:ed)?|develop(?:ed|ment)?|built)\s+by\s+(?!wordpress|shopify|wix|squarespace|webflow|godaddy|weebly|google|us\b|owner)[a-z0-9][\w .&-]{2,}|réalis[ée]{1,2}\s+par\s+[a-z]|cr[ée]{2,}\s+par\s+[a-z]|conception\s*[:&]|agence\s+web|web\s+agency/i;

function checkDisqualified(lead, html) {
  const name = lead.name || "";

  if (FRANCHISE.test(name)) {
    return { disqualified: true, disqualified_reason: "franchise/national chain" };
  }
  // NOTE: a high review count is NO LONGER a disqualifier. In the multi-service
  // model (website / SEO / chatbot), a thriving big local business is a PRIME
  // prospect — it has the money. It's kept and ranked by the tier logic instead.

  if (html && AGENCY_CREDIT.test(html)) {
    return { disqualified: true, disqualified_reason: "site already built by an agency" };
  }

  return { disqualified: false, disqualified_reason: null };
}

module.exports = { checkDisqualified };
