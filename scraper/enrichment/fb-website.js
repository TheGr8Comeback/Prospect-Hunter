// Recover the REAL website from a Facebook business page.
//
// A huge share of "no real website" leads simply list their site on their
// Facebook page instead of on Google. Their GMB link points at facebook.com,
// so we flag them as siteless — a fabricated web gap that inflates the tier.
// Here we fetch the FB page and pull the external site it advertises.
//
// Facebook exposes outbound links through a redirect shim:
//   https://l.facebook.com/l.php?u=<url-encoded real site>&h=...
// and sometimes as a plain href in the page's contact/"Website" block.

const { load } = require("cheerio");
const { detectWebsiteType } = require("./website-type");

// Hosts that are Facebook/Meta plumbing or other socials — never the business site.
const NON_SITE_HOSTS = /(?:^|\.)(facebook\.com|fb\.com|fb\.me|fbcdn\.net|fbsbx\.com|instagram\.com|messenger\.com|meta\.com|whatsapp\.com|l\.facebook\.com|threads\.net|linktr\.ee|google\.com|youtube\.com|goo\.gl|bit\.ly)$/i;

function hostOf(url) {
  try {
    let u = url;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

// Pull the first plausible business website out of Facebook page HTML.
function extractWebsiteFromFacebook(html) {
  if (typeof html !== "string" || !html) return null;
  const $ = load(html);
  const candidates = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";

    // 1. l.php redirect shim → decode the ?u= target
    const m = href.match(/l\.php\?u=([^&]+)/i);
    if (m) {
      try { candidates.push(decodeURIComponent(m[1])); } catch { /* skip */ }
      return;
    }
    // 2. plain external link
    if (/^https?:\/\//i.test(href)) candidates.push(href);
  });

  for (const raw of candidates) {
    const host = hostOf(raw);
    if (!host || NON_SITE_HOSTS.test(host)) continue;
    // A real site has a normal host; skip obvious tracking/login params-only.
    return raw.split("#")[0];
  }
  return null;
}

// Registry-facing runner: fetch the FB /about page and recover the site.
// `fetchPage(url, timeout)` is injected so this stays testable without network.
async function recoverSiteFromFacebook(facebookUrl, fetchPage) {
  const fbMatch = facebookUrl && facebookUrl.match(/facebook\.com\/([a-zA-Z0-9._-]+)/i);
  if (!fbMatch) return null;
  const pageName = fbMatch[1];

  const urls = [
    `https://m.facebook.com/${pageName}/about`,
    `https://www.facebook.com/${pageName}/about`,
    `https://m.facebook.com/${pageName}`,
  ];

  for (const url of urls) {
    try {
      const html = await fetchPage(url, 8000);
      if (!html || html.length < 1000) continue;
      const site = extractWebsiteFromFacebook(html);
      if (site) return site;
    } catch {
      continue;
    }
  }
  return null;
}

// Given a lead + a fetcher, returns the enrichment updates:
//   - fb_checked: true (we looked)
//   - when a site is recovered: website + fresh website-type classification
async function enrichFromFacebook(lead, fetchPage) {
  const updates = { fb_checked: true };
  const facebook = lead.facebook;
  if (!facebook) return updates;

  const site = await recoverSiteFromFacebook(facebook, fetchPage);
  if (site) {
    updates.website = site;
    updates.has_website = true;
    Object.assign(updates, detectWebsiteType(site)); // no_real_website → false
  }
  return updates;
}

module.exports = { extractWebsiteFromFacebook, recoverSiteFromFacebook, enrichFromFacebook };
