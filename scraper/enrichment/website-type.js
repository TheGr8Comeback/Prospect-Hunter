// Structural web-presence classification — the STRONG cold-email angles.
// A business owner doesn't feel "my site is slow", but he feels "I have no
// real website" or "my site is a free wixsite that looks cheap". Derived from
// the URL string alone — no fetch, works even without page HTML.

// Domains that mean "no real website" — the GMB link points at a social/
// link-in-bio page used AS the website.
const SOCIAL_AS_SITE = [
  "facebook.com", "m.facebook.com", "business.facebook.com", "fb.com", "fb.me",
  "instagram.com", "l.instagram.com", "linktr.ee", "linktree.com", "beacons.ai",
  "taplink.cc", "campsite.bio", "allmylinks.com", "tiktok.com", "yelp.com",
  "nextdoor.com", "linktr.ee", "solo.to", "bio.link", "msha.ke",
];

// Free website builders / subdomains — a real but amateur/temporary presence.
const FREE_BUILDER = [
  "wixsite.com", "business.site", "godaddysites.com", "weebly.com", "square.site",
  "wordpress.com", "blogspot.com", "jimdofree.com", "jimdosite.com", "webnode",
  "mystrikingly.com", "strikingly.com", "site123.me", "webs.com", "yolasite.com",
  "simplesite.com", "ucraft.net", "companywebsite.site", "websitebuilder.com",
  "carrd.co", "glideapp.io", "durable.co",
];

function hostOf(url) {
  try {
    let u = url;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function detectWebsiteType(url) {
  if (!url) return { no_real_website: true, free_builder: false, website_kind: "none" };

  const host = hostOf(url);
  if (!host) return { no_real_website: true, free_builder: false, website_kind: "none" };

  if (SOCIAL_AS_SITE.some((d) => host === d || host.endsWith("." + d))) {
    return { no_real_website: true, free_builder: false, website_kind: "social" };
  }
  if (FREE_BUILDER.some((d) => host === d || host.endsWith("." + d))) {
    return { no_real_website: false, free_builder: true, website_kind: "free_builder" };
  }
  return { no_real_website: false, free_builder: false, website_kind: "custom" };
}

module.exports = { detectWebsiteType };
