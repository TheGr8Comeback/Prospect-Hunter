// On-page SEO audit — parsed from the HTML we already fetched (zero extra
// request). Off-page SEO (backlinks / domain authority) needs a paid API and
// is out of scope; this covers the on-page gaps a freelance rebuilds a site on.
const { load } = require("cheerio");

function analyzeSeo(html) {
  const $ = load(html);
  const d = {};

  const title = $("title").first().text().trim();
  d.title = !!title;
  d.title_len_ok = title.length >= 30 && title.length <= 65;

  const metaDesc = ($('meta[name="description"]').attr("content") || "").trim();
  d.meta_description = !!metaDesc;
  d.meta_desc_len_ok = metaDesc.length >= 110 && metaDesc.length <= 165;

  const h1 = $("h1");
  d.h1 = h1.length > 0;
  d.single_h1 = h1.length === 1;

  d.canonical = $('link[rel="canonical"]').length > 0;
  d.open_graph = $('meta[property^="og:"]').length >= 2;
  d.twitter_card = $('meta[name^="twitter:"]').length > 0;
  d.schema_org = $('script[type="application/ld+json"]').length > 0;
  d.lang = !!$("html").attr("lang");

  const imgs = $("img");
  const withAlt = imgs.filter((_, el) => (($(el).attr("alt") || "").trim().length > 0)).length;
  d.img_alt_ratio = imgs.length ? Math.round((withAlt / imgs.length) * 100) / 100 : 1;

  const robots = ($('meta[name="robots"]').attr("content") || "").toLowerCase();
  d.noindex = /noindex/.test(robots);

  // Composite 0-100 (on-page). Absence/brokenness lowers it — that's the pitch.
  let s = 0;
  if (d.title) s += 12;
  if (d.title_len_ok) s += 4;
  if (d.meta_description) s += 12;
  if (d.meta_desc_len_ok) s += 4;
  if (d.h1) s += 12;
  if (d.single_h1) s += 4;
  if (d.canonical) s += 10;
  if (d.open_graph) s += 14;
  if (d.twitter_card) s += 4;
  if (d.schema_org) s += 10;
  s += Math.round(d.img_alt_ratio * 10); // up to 10
  if (d.lang) s += 4;
  if (d.noindex) s = Math.max(0, s - 25); // deindexed = big red flag

  return { seo_score: Math.min(100, s), seo_detail: d };
}

function enrichSeo(html) {
  if (typeof html !== "string" || !html) return null;
  return analyzeSeo(html);
}

module.exports = { enrichSeo, analyzeSeo };
