// Real performance via Google PageSpeed Insights (Lighthouse) — Tier-1 #1.
//
// Turns a vague "slow-ish" feeling into a hard, quotable number
// ("mobile score 31/100") that lands in a cold email. Mobile strategy only:
// local buyers are on phones, and it halves the API cost.
//
// The call is slow (~10-30s) and quota-limited, so isWorthChecking() gates it
// to promising leads only (live site + proof of money). Set PAGESPEED_API_KEY
// in the env to lift the anonymous rate limit (free key, 25k/day).

const { isDeadStatus } = require("../utils/http-status");

const API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

function isWorthChecking(lead) {
  // A 401/403/429 means the site blocked our scraper, not that it's dead —
  // PageSpeed fetches the page itself (as a real browser), so it can still
  // succeed even when our own scrape got bot-blocked.
  const liveSite = !!lead.website && !lead.is_parked && !isDeadStatus(lead.status_code);
  if (!liveSite) return false;
  const reviews = lead.reviews_count || 0;
  const rating = lead.rating || 0;
  return reviews >= 30 || lead.ad_active === true || (rating >= 4.5 && reviews >= 10);
}

async function fetchScore(url, strategy) {
  const params = new URLSearchParams({ url, strategy, category: "performance" });
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);

  const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`PageSpeed ${res.status}`);

  const data = await res.json();
  const score = data?.lighthouseResult?.categories?.performance?.score;
  return typeof score === "number" ? Math.round(score * 100) : null;
}

async function enrichPageSpeed(website) {
  let url = website;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  try {
    const mobile_score = await fetchScore(url, "mobile");
    if (mobile_score === null) return null;
    return { mobile_score, pagespeed_checked_at: new Date().toISOString() };
  } catch {
    return null; // never let a slow/failed PageSpeed call break enrichment
  }
}

module.exports = { enrichPageSpeed, isWorthChecking };
