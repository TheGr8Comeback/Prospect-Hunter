// Review-mining (module #3) — scan customer reviews for complaints about the
// business's WEBSITE or ONLINE BOOKING. When a business's own customers write
// "couldn't book online" or "no website", that is explicit, third-party proof
// of the exact pain the draft-first offer solves — the strongest sales angle
// there is.
//
// Pure function: give it an array of review texts, get back a pain count plus
// the quotes to drop into a pitch. It does NOT fetch reviews — the caller
// (e.g. sources/gmaps.js) is responsible for capturing review text.
//
// Matching is phrase-based (never single words like "website") to avoid false
// positives from neutral mentions. Bilingual EN/FR.

const PAIN_PATTERNS = [
  // — English —
  /no\s+website/i,
  /(?:website|site|page)\s+(?:doesn'?t|does not|won'?t|will not|never)\s+(?:work|load|open)/i,
  /(?:website|site)\s+(?:is\s+)?(?:down|broken|outdated|old|useless)/i,
  /can'?t\s+(?:find|book|order).{0,20}(?:online|website|site)/i,
  /(?:couldn'?t|could not|unable to)\s+book(?:\s+online)?/i,
  /no\s+(?:online\s+)?(?:booking|ordering|reservation)/i,
  /had\s+to\s+call\b/i,
  /(?:hard|difficult|impossible)\s+to\s+(?:find|book|reach).{0,15}(?:online|website)/i,
  /broken\s+(?:link|website|site)/i,
  // — French —
  /(?:pas|aucun|aucune)\s+(?:de\s+)?site(?:\s+(?:web|internet))?/i,
  /site\s+(?:web\s+)?(?:ne\s+(?:marche|fonctionne)\s+pas|est\s+(?:down|hs|introuvable|pas\s+à\s+jour))/i,
  /impossible\s+de\s+(?:réserver|reserver|commander)(?:\s+en\s+ligne)?/i,
  /(?:aucune|pas\s+de)\s+réservation\s+en\s+ligne/i,
  /(?:obligé|oblige|forcé|force)\s+d'?appeler/i,
  /site\s+introuvable/i,
];

/**
 * @param {Array<string|{text:string}>} reviews
 * @returns {{ review_pain: number, review_pain_quotes: string[] }}
 */
function mineReviewPain(reviews, maxQuotes = 3) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return { review_pain: 0, review_pain_quotes: [] };
  }

  let count = 0;
  const quotes = [];

  for (const r of reviews) {
    const text = (typeof r === "string" ? r : r?.text) || "";
    if (!text) continue;

    const hit = PAIN_PATTERNS.some((p) => p.test(text));
    if (hit) {
      count++;
      if (quotes.length < maxQuotes) {
        const trimmed = text.trim().replace(/\s+/g, " ");
        quotes.push(trimmed.length > 160 ? trimmed.slice(0, 157) + "…" : trimmed);
      }
    }
  }

  return { review_pain: count, review_pain_quotes: quotes };
}

module.exports = { mineReviewPain };
