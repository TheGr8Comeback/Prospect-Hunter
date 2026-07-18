/**
 * cleanBusinessName — conservatively strip SEO spam from Google Maps names.
 * Only cleans when confident. Better to keep a long name than destroy a brand.
 *
 * "Teeth Cleaning, Teeth Filling, Extractions, TMJ Treatment Satwa Cosmocare" → "TMJ Treatment Satwa Cosmocare"
 * "DrJuliana Saba - Best Dentist in Dubai - Romanian Dentist in Dubai" → "DrJuliana Saba"
 * "Del Air Heating and Air Conditioning" → "Del Air Heating and Air Conditioning" (untouched)
 */
function cleanBusinessName(name) {
  if (!name || typeof name !== "string") return name;

  let cleaned = name.trim();

  // 1. Remove legal suffixes: LLC, Inc, Ltd, Pty Ltd, Corp
  cleaned = cleaned.replace(/\b(LLC|Inc\.?|Ltd\.?|Pty\s*Ltd|Corp\.?)\b/gi, "");

  // 2. Split on SPACED separators only: " - ", " – ", " — ", " | "
  //    Never split on hyphens inside compound names (Del-Air, Smith-Miller)
  const sepParts = cleaned.split(/\s+[-–—|]\s+/);
  if (sepParts.length > 1 && sepParts[0].trim().length >= 3) {
    cleaned = sepParts[0].trim();
  }

  // 3. Comma-separated service lists: need 3+ commas to be confident
  //    "Teeth Cleaning, Teeth Filling, Extractions, TMJ Treatment Satwa Cosmocare"
  const commaCount = (cleaned.match(/,/g) || []).length;
  if (commaCount >= 3) {
    const lastPart = cleaned.split(",").pop().trim();
    if (lastPart.split(/\s+/).length >= 2 && lastPart.length >= 8) {
      cleaned = lastPart;
    }
  }

  // 4. Remove price mentions (AED99, $50, etc.)
  cleaned = cleaned.replace(/\b[A-Z]{2,3}\d{2,4}\b/g, "");
  cleaned = cleaned.replace(/\$\d+/g, "");

  // 5. Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 6. If cleaning removed too much, fall back to original
  if (cleaned.length < 3) return name.trim();

  return cleaned;
}

/**
 * slugify — lowercase + NFD normalize + strip accents + spaces→hyphens
 * Max 60 chars, truncated at word boundary
 */
const MAX_SLUG_LENGTH = 60;

function slugify(text) {
  if (!text || typeof text !== "string") return "";

  let slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  // Truncate at word boundary if too long
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.substring(0, MAX_SLUG_LENGTH);
    const lastHyphen = slug.lastIndexOf("-");
    if (lastHyphen > 20) {
      slug = slug.substring(0, lastHyphen);
    }
  }

  return slug;
}

module.exports = { slugify, cleanBusinessName };
