// Pitch-ammo layer — turns raw enrichment signals into a ranked list of
// short, quotable outreach angles. This is what makes a lead ACTIONABLE:
// not "score 82" but "312 reviews at 4.9★ but no online booking and a mobile
// score of 31/100". Feeds both lead triage and generate-pitches-auto.js.
//
// Pure function over an already-enriched lead. English output (grafts directly
// into the English pitch generator). Each hook is weighted so the strongest
// angle leads; we keep the top few.

const { isDeadStatus } = require("../utils/http-status");

const CURRENT_YEAR = new Date().getFullYear();

function buildHooks(lead) {
  const hooks = [];
  const push = (type, weight, text) => hooks.push({ type, weight, text });

  // Only a GENUINELY dead site (404/410/5xx) is "down". A 401/403/429 is the
  // site's anti-bot blocking us — it's alive for a human, so it must NOT
  // produce a "website is down" hook (see utils/http-status.js).
  const siteDown = lead.is_parked || isDeadStatus(lead.status_code);
  const hasLiveSite = !!lead.website && !siteDown;

  // ── MONEY — proof the business is thriving (lead with the compliment) ──
  if (lead.reviews_count >= 50 && lead.rating >= 4.3) {
    push("money", 90, `${lead.reviews_count} reviews at ${lead.rating}★ — clearly a busy, trusted business`);
  } else if (lead.reviews_count >= 100) {
    push("money", 80, `${lead.reviews_count} reviews — high-volume operation`);
  }
  if (lead.review_velocity >= 3) {
    push("money", 83, `${lead.review_velocity}+ reviews in the last 3 months — active right now`);
  }
  if (lead.ad_active) {
    const platforms = (lead.ad_platforms || []).join("/") || "paid";
    push("money", 85, `already running ${platforms} ads — proven marketing budget`);
  }

  // ── PAIN — STRUCTURAL gaps lead (owners feel absence, not slowness) ──
  const noRealSite = lead.no_real_website || !lead.website;
  if (noRealSite) {
    push("pain", 96, lead.facebook
      ? `no real website — customers only find a Facebook page`
      : `no website at all`);
  } else if (siteDown) {
    push("pain", 95, `website is down / unreachable`);
  } else {
    if (lead.free_builder) {
      push("pain", 80, `site is on a free builder — looks temporary/amateur`);
    }
    if (lead.copyright_year && lead.copyright_year <= CURRENT_YEAR - 7) {
      push("pain", 68, `site hasn't been updated since ${lead.copyright_year}`);
    }
    if (lead.https === false) {
      push("pain", 62, `site isn't secure (no HTTPS) — browsers warn visitors`);
    }
    // conversion gaps — real, felt friction for a local business
    if (lead.has_online_booking === false) {
      push("conversion", 78, `no online booking — customers have to call`);
    }
    if (lead.has_contact_form === false) {
      push("conversion", 58, `no contact form / online way to reach them`);
    }
    // performance DEMOTED — only flag a genuinely broken (not just slow) site
    if (typeof lead.mobile_score === "number" && lead.mobile_score < 35) {
      push("pain", 48, `barely usable on mobile (${lead.mobile_score}/100)`);
    }
  }

  // ── INTENT — customers publicly complaining ──
  if (lead.review_pain > 0 && lead.review_pain_quotes && lead.review_pain_quotes.length) {
    push("intent", 92, `customers complain about the site/booking: "${lead.review_pain_quotes[0]}"`);
  }

  hooks.sort((a, b) => b.weight - a.weight);
  return { hooks: hooks.slice(0, 6).map((h) => h.text) };
}

module.exports = { buildHooks };
