// Warm lead score (0-100) — the INVERSE philosophy of scoring/score.js.
//
// The composite score rewards a great web presence. But a lead with a great
// site does not need a new one. The warm score rewards the opposite profile:
//
//   PAIN   (0-40) — broken / dated / absent web presence  → they NEED it
//   MONEY  (0-35) — busy, well-reviewed, real establishment → they can PAY
//   INTENT (0-25) — dead site, running ads, complaints      → in-market NOW
//
// A high warm_score = a successful business with a bad/no website that is
// showing a buying trigger. That is a lead worth a personalized draft.
//
// Forward-compatible: `ad_active` (module #2) and `review_pain` (module #3)
// are read here but stay falsy until those enrichers run, so the score lifts
// automatically once they land — no change needed in this file.

const { isDeadStatus } = require("../utils/http-status");

const CURRENT_YEAR = new Date().getFullYear();

function webPain(lead) {
  // No website at all — maximum need (nothing to build from).
  if (!lead.website) return 40;

  // Dead or parked domain — forced to act. A 401/403/429 means the site
  // blocked OUR scraper, not that it's broken for a real visitor — never
  // treat a bot-block as dead (see utils/http-status.js).
  if (lead.is_parked || isDeadStatus(lead.status_code)) return 40;

  // Live but flawed site — grade the missing fundamentals.
  let p = 0;
  if (!lead.https) p += 10;
  if (!lead.mobile_friendly) p += 14; // mobile is the costliest real-world gap
  if (!lead.copyright_year || lead.copyright_year <= CURRENT_YEAR - 6) p += 10;
  if (!lead.meta_desc_present) p += 3;
  if (!lead.favicon_present) p += 3;
  return Math.min(p, 40);
}

function money(lead) {
  let m = 0;
  // Review volume proxies revenue — 100+ reviews = an established, busy shop.
  if (lead.reviews_count) m += Math.min(lead.reviews_count / 100, 1) * 20;
  // A strong rating signals a reputation worth protecting online.
  if (lead.rating) m += (lead.rating / 5) * 10;
  // A physical address confirms a real, reachable establishment.
  if (lead.address) m += 5;
  return Math.min(m, 35);
}

function intent(lead) {
  let i = 0;
  // A dead/parked site is itself an active trigger: they must replace it.
  // (Bot-blocked ≠ dead — see webPain above.)
  if (lead.is_parked || isDeadStatus(lead.status_code)) i += 12;
  // Currently paying for ads — proven budget + belief in marketing (module #2).
  if (lead.ad_active) i += 13;
  // Customers publicly complaining about the site/booking (module #3).
  if (lead.review_pain && lead.review_pain > 0) i += 12;
  return Math.min(i, 25);
}

function computeWarmScore(lead) {
  const pain = webPain(lead);
  const cash = money(lead);
  const trig = intent(lead);
  const total = Math.round(pain + cash + trig);

  return {
    warm_score: total,
    warm_detail: {
      pain: Math.round(pain),
      money: Math.round(cash),
      intent: Math.round(trig),
    },
  };
}

module.exports = { computeWarmScore };
