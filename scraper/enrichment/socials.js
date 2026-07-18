const { load } = require("cheerio");

const SOCIAL_PATTERNS = [
  { key: "facebook",  re: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+/i },
  { key: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/i },
  { key: "linkedin",  re: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._-]+/i },
  { key: "twitter",   re: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9._-]+/i },
  { key: "tiktok",    re: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/i },
  { key: "youtube",   re: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)[A-Za-z0-9._-]+/i },
];

const IGNORED_PATHS = /\/(sharer|share|intent|hashtag|home|login|signup|watch\?|search|policies|help|about|people|pages|groups|events|dialog)\b/i;

function extractSocials(html) {
  if (typeof html !== "string" || !html) return {};
  const $ = load(html);
  const result = {};

  const allHrefs = [];
  $("a[href]").each((_, el) => {
    allHrefs.push($(el).attr("href"));
  });

  for (const { key, re } of SOCIAL_PATTERNS) {
    for (const href of allHrefs) {
      if (!href) continue;
      const match = href.match(re);
      if (match && !IGNORED_PATHS.test(match[0])) {
        result[key] = match[0].replace(/\/+$/, "");
        break;
      }
    }
  }

  return result;
}

module.exports = { extractSocials };
