// The war machine: classify each lead into a clean, filterable tier for a
// cold-email campaign. Unlike warm_score (a fuzzy 0-100), this is a decision:
// PERFECT leads ARE the campaign list.
//
// A PERFECT lead is a THRIVING business with a GLARING STRUCTURAL web gap that
// you can REACH BY EMAIL and that isn't a chain/agency. Aesthetics/speed do
// NOT make a lead perfect — owners don't feel those. Absence/brokenness does.
//
// Thresholds are tunable here.
const { phoneChannel } = require("../utils/phone-channel");
const { isDeadStatus } = require("../utils/http-status");

const CFG = {
  THRIVING_REVIEWS: 40,   // busy enough to have cash + care about image
  THRIVING_RATING: 4.0,   // reputable
  HIGH_VOLUME_REVIEWS: 100, // busy on its own even if rating unknown
};

// Proven, revenue-generating business.
function isThriving(lead) {
  const r = lead.reviews_count || 0;
  const rating = lead.rating || 0;
  if (r >= CFG.HIGH_VOLUME_REVIEWS) return true;
  return r >= CFG.THRIVING_REVIEWS && rating >= CFG.THRIVING_RATING;
}

// A gap the OWNER feels — structural absence or brokenness.
function structuralGap(lead) {
  // "No real website" is INCONCLUSIVE until fb_checked: the site is very often
  // listed only on the business's Facebook page. A lead we haven't verified —
  // including one whose FB page we don't even have — is NOT a confirmed gap, so
  // it can't earn PERFECT/STRONG. It falls through to no gap → at most MAYBE.
  if (lead.no_real_website) {
    if (!lead.fb_checked) return null;
    return lead.facebook ? "facebook-only, no real website" : "no website at all";
  }
  // Only 404/410/5xx = genuinely dead. A 403/429 means the site blocked our
  // scraper (anti-bot), NOT that it's broken for a real visitor — see http-status.
  if (lead.is_parked || isDeadStatus(lead.status_code)) return "website is dead / unreachable";
  if (lead.free_builder) return "site on a free builder — looks temporary";
  return null;
}

// A real, sellable SERVICE angle on a working site — SEO / chatbot / perf /
// dated / insecure. Softer than a structural web gap, but still a concrete
// reason to reach out. This is what turns a working-but-mediocre site into a
// STRONG prospect instead of a SKIP (multi-service model).
function serviceGap(lead) {
  if (lead.seo_score != null && lead.seo_score < 45) return "weak on-page SEO";
  if (lead.chatbot_opportunity) return "no chatbot + service complaints";
  if (lead.mobile_score != null && lead.mobile_score < 40) return "slow on mobile";
  const oldYear = lead.copyright_year && lead.copyright_year <= new Date().getFullYear() - 7;
  if (oldYear) return "site not updated in years";
  if (lead.https === false) return "site not secure (no HTTPS)";
  return null;
}

// Reachable through a channel you can actually use: a valid email, OR a
// WhatsApp-capable mobile (landline / social-only don't count — no FB access).
function hasValidEmail(lead) {
  if (!lead.email) return false;
  return lead.email_status !== "invalid";
}
function isReachable(lead) {
  return hasValidEmail(lead) || phoneChannel(lead.phone).whatsappable;
}

function classifyLead(lead) {
  if (lead.disqualified) {
    return { lead_tier: "SKIP", tier_reason: lead.disqualified_reason || "disqualified" };
  }

  const thriving = isThriving(lead);
  const gap = structuralGap(lead);   // glaring, owner-felt web gap
  const svc = serviceGap(lead);      // sellable service angle (SEO/chatbot/perf/dated)
  const reachable = isReachable(lead);

  // PERFECT — thriving, a glaring structural gap, and reachable by email/WhatsApp.
  if (thriving && gap && reachable) {
    return { lead_tier: "PERFECT", tier_reason: `thriving + ${gap} + reachable` };
  }
  // STRONG — thriving with a real angle: a structural gap we can't email, or a
  // clear service angle (SEO / chatbot / perf / dated site).
  if (thriving && gap) {
    return { lead_tier: "STRONG", tier_reason: `thriving + ${gap} — hard to reach` };
  }
  if (thriving && svc) {
    return { lead_tier: "STRONG", tier_reason: `thriving + ${svc}${reachable ? " + reachable" : ""}` };
  }

  // MAYBE — a thriving business is ALWAYS worth a look (redesign/SEO/chatbot
  // upsell), even without a clear gap yet. Also: a gap on a non-thriving lead.
  if (thriving) {
    return { lead_tier: "MAYBE", tier_reason: "thriving — no clear gap yet (SEO/chatbot/redesign?)" };
  }
  if (gap || svc) {
    return { lead_tier: "MAYBE", tier_reason: `${gap || svc} but not thriving` };
  }

  // SKIP — good site, or nothing to work with.
  return { lead_tier: "SKIP", tier_reason: "no structural gap / not a fit" };
}

module.exports = { classifyLead, CFG };
