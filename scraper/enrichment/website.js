const https = require("https");
const http = require("http");
const { URL } = require("url");
const { load } = require("cheerio");
const rateLimiter = require("../utils/rate-limiter");
const { isDeadStatus, isBotBlockStatus } = require("../utils/http-status");

// Default identifies us honestly; the browser UA is a fallback for sites that
// 403/429 any non-browser client (WAF / Cloudflare / franchise gateways).
const DEFAULT_UA = "Mozilla/5.0 (compatible; ProspectOS/1.0)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function fetchPage(url, timeout = 10_000, userAgent = DEFAULT_UA) {
  await rateLimiter.wait(url);

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.request(parsed, {
      timeout,
      // Force IPv4. Many business domains publish an AAAA record but the host
      // has no working IPv6 route — Node then tries IPv6 first and fails with a
      // fast ETIMEDOUT instead of falling back, silently killing enrichment for
      // ~half the base. IPv4 is universal for local-business sites.
      family: 4,
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        fetchPage(next, timeout - (Date.now() - start), userAgent)
          .then(resolve)
          .catch(reject);
        return;
      }

      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        resolve({
          html: data,
          statusCode: res.statusCode,
          responseTimeMs: Date.now() - start,
          finalUrl: url,
        });
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.on("error", reject);
    req.end();
  });
}

// ── Parked / dead site detection ────────────────────────────
const PARKED_PATTERNS = [
  /this\s+domain\s+is\s+for\s+sale/i,
  /buy\s+this\s+domain/i,
  /domain\s+is\s+parked/i,
  /parked\s+by/i,
  /domain\s+parking/i,
  /this\s+page\s+is\s+provided\s+courtesy\s+of/i,
  /godaddy\.com\/forsale/i,
  /sedoparking\.com/i,
  /parkingcrew\.net/i,
  /hugedomains\.com/i,
  /afternic\.com/i,
  /dan\.com/i,
  /sav\.com/i,
  /undeveloped\.com/i,
  /domainmarket\.com/i,
  /is\s+available\s+for\s+purchase/i,
  /domain\s+name\s+has\s+been\s+registered/i,
  /website\s+is\s+coming\s+soon/i,
  /under\s+construction/i,
  /future\s+home\s+of\s+something/i,
  /squarespace\.com\/templates/i,
  /wixsite\.com.*\/blank/i,
];

function isParkedSite(html, statusCode) {
  // Genuinely dead (404/410/5xx) counts as parked/no-real-site. A bot-block
  // (403/429) does NOT — the site is alive, we just couldn't read it.
  if (isDeadStatus(statusCode)) return true;
  if (isBotBlockStatus(statusCode)) return false;
  if (!html || html.length < 500) return true;

  const lower = html.toLowerCase();
  for (const pattern of PARKED_PATTERNS) {
    if (pattern.test(lower)) return true;
  }

  return false;
}

// ── Paid-advertising signal (module #2) ─────────────────────
// A business running ads almost always installs a tracking pixel/conversion
// tag. These live in the page HTML we already fetched — so we infer ad spend
// with zero extra requests and no fragile Ad Library scraping. Presence is a
// strong correlate of paid activity, not absolute proof (a pixel can be used
// for organic retargeting too).
const AD_SIGNALS = [
  ["facebook", /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init['"]/i],
  ["google_ads", /googleadservices\.com\/pagead\/conversion|gtag\(\s*['"]config['"]\s*,\s*['"]AW-|[^a-z]AW-\d{9,}/i],
  ["bing", /bat\.bing\.com\/bat\.js|uetq/i],
  ["tiktok", /analytics\.tiktok\.com/i],
  ["linkedin", /snap\.licdn\.com\/li\.lms-analytics/i],
];

function detectAdSignals(html) {
  const platforms = [];
  for (const [name, pattern] of AD_SIGNALS) {
    if (pattern.test(html)) platforms.push(name);
  }
  return { ad_active: platforms.length > 0, ad_platforms: platforms };
}

// ── Conversion elements (Tier-1 #3) ─────────────────────────
// The features a local business needs to actually turn a visitor into a
// customer. Their ABSENCE is a concrete, quotable pitch angle ("customers
// can't book you online"). Detected from the fetched HTML — no extra request.
const BOOKING_PATTERNS =
  /calendly\.com|cal\.com\/|acuityscheduling|squareup\.com\/appointments|setmore|simplybook|youcanbook\.me|appointlet|vagaro|schedulicity|resurva|timify|booksy|planity\.com|doctolib\.fr|zenchef|thefork|resmio|guestonline|opentable/i;
const BOOKING_TEXT =
  /\b(book\s+(?:now|online|an?\s+appointment)|schedule\s+(?:now|online|an?\s+appointment)|réserver|reservez|prendre\s+rendez-?vous|prenez\s+rendez-?vous)\b/i;

function detectConversionElements($, html) {
  const has_click_to_call = $('a[href^="tel:"]').length > 0;

  const has_online_booking =
    BOOKING_PATTERNS.test(html) || BOOKING_TEXT.test($("a").text());

  // A real contact path: a form with a message/email field, or a mailto link.
  const formHasContactField =
    $("form").filter((_, f) =>
      $(f).find('textarea, input[type="email"]').length > 0
    ).length > 0;
  const has_contact_form = formHasContactField || $('a[href^="mailto:"]').length > 0;

  return { has_online_booking, has_click_to_call, has_contact_form };
}

function analyze(url, html, statusCode, responseTimeMs) {
  const $ = load(html);
  const isHttps = url.startsWith("https");
  const parked = isParkedSite(html, statusCode);
  const { ad_active, ad_platforms } = detectAdSignals(html);
  const conversion = detectConversionElements($, html);

  const viewportMeta = $('meta[name="viewport"]').attr("content") || "";
  const mobileFriendly = /width\s*=\s*device-width/i.test(viewportMeta);

  let copyrightYear = null;
  const copyrightMatch = html.match(/©\s*(\d{4})|copyright\s*(\d{4})/i);
  if (copyrightMatch) {
    copyrightYear = parseInt(copyrightMatch[1] || copyrightMatch[2]);
  }

  const techStack = [];
  if (/wp-content|wordpress/i.test(html)) techStack.push("wordpress");
  if (/Shopify/i.test(html)) techStack.push("shopify");
  if (/wix\.com/i.test(html)) techStack.push("wix");
  if (/squarespace/i.test(html)) techStack.push("squarespace");
  if (/react/i.test(html) && /react-dom|__NEXT_DATA__/i.test(html)) techStack.push("react");
  if (/__NEXT_DATA__/i.test(html)) techStack.push("nextjs");
  if (/nuxt/i.test(html)) techStack.push("nuxt");
  if (/webflow/i.test(html)) techStack.push("webflow");

  const titlePresent = !!$("title").text().trim();
  const metaDescPresent = !!$('meta[name="description"]').attr("content")?.trim();
  const faviconPresent = !!($('link[rel="icon"]').length || $('link[rel="shortcut icon"]').length);
  const htmlSizeKb = Math.round((Buffer.byteLength(html) / 1024) * 10) / 10;

  return {
    https: isHttps,
    mobile_friendly: mobileFriendly,
    copyright_year: copyrightYear,
    tech_stack: techStack,
    html_size_kb: htmlSizeKb,
    title_present: titlePresent,
    meta_desc_present: metaDescPresent,
    favicon_present: faviconPresent,
    response_time_ms: responseTimeMs,
    status_code: statusCode,
    is_parked: parked,
    ad_active,
    ad_platforms,
    ad_checked_at: new Date().toISOString(),
    has_online_booking: conversion.has_online_booking,
    has_click_to_call: conversion.has_click_to_call,
    has_contact_form: conversion.has_contact_form,
  };
}

async function enrichWebsite(lead) {
  if (!lead.website) return null;

  let url = lead.website;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  try {
    let res = await fetchPage(url);
    // Bot-blocked with our honest UA? Retry once as a real browser before we
    // conclude anything — many WAFs 403 non-browser clients on sight.
    if (isBotBlockStatus(res.statusCode)) {
      try {
        const retry = await fetchPage(url, 5_000, BROWSER_UA);
        if (!isBotBlockStatus(retry.statusCode)) res = retry;
      } catch { /* keep the first result */ }
    }
    const { html, statusCode, responseTimeMs, finalUrl } = res;

    // Bot-blocked (401/403/429) even after the browser-UA retry: the site is
    // alive but refused us, so the (near-empty) error body is NOT the real
    // page. Analyzing it fabricates fake content signals — a bogus low
    // seo_score, "no title", "not mobile" — which inflate the tier into a false
    // STRONG (see utils/http-status.js). Record only the transport-level facts
    // and return _html: null so seo / chatbot / socials / emails all skip.
    if (isBotBlockStatus(statusCode)) {
      return {
        https: finalUrl.startsWith("https"),
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        is_parked: false,
        website_score: null,
        _html: null,
      };
    }

    const signals = analyze(finalUrl, html, statusCode, responseTimeMs);

    // Parked site — mark as no real website, skip enrichment
    if (signals.is_parked) {
      return { ...signals, website_score: 0, has_website: false, _html: null };
    }

    let websiteScore = 0;
    if (signals.https) websiteScore += 5;
    if (signals.mobile_friendly) websiteScore += 8;
    if (signals.copyright_year && signals.copyright_year >= 2022) websiteScore += 5;
    if (signals.meta_desc_present) websiteScore += 4;
    if (signals.favicon_present) websiteScore += 3;

    return { ...signals, website_score: websiteScore, _html: html };
  } catch {
    return null;
  }
}

module.exports = { enrichWebsite };
