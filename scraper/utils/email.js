/**
 * isRealEmail — filtre les faux emails (JS placeholders, variables, etc.)
 * Règles :
 *   - locale ≥ 4 chars
 *   - sld (domaine principal) ≥ 3 chars
 *   - tld ≤ 6 chars
 */
function isRealEmail(email) {
  if (!email || typeof email !== "string") return false;
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,6}$/i.test(email)) return false;
  const [local, domain] = email.toLowerCase().split("@");
  const parts = domain.split(".");
  const tld   = parts[parts.length - 1];
  const sld   = parts[parts.length - 2];
  if (local.length < 4)  return false;
  if (sld.length < 3)    return false;
  if (tld.length > 6)    return false;
  return true;
}

/**
 * classifyEmail — personal vs generic
 * Generic = info@, contact@, admin@, support@, hello@, office@, sales@, service@, etc.
 * Personal = anything that looks like a person's name (john@, jsmith@, rayan@)
 */
const GENERIC_PREFIXES = new Set([
  "info", "contact", "admin", "support", "hello", "office", "sales",
  "service", "help", "billing", "enquiries", "enquiry", "general",
  "team", "staff", "mail", "email", "webmaster", "postmaster",
  "noreply", "no-reply", "marketing", "media", "press", "hr",
  "jobs", "careers", "feedback", "complaints", "reception",
  "frontdesk", "front-desk", "customerservice", "customer-service",
]);

function classifyEmail(email) {
  if (!email || typeof email !== "string") return null;
  const local = email.toLowerCase().split("@")[0];
  return GENERIC_PREFIXES.has(local) ? "generic" : "personal";
}

/**
 * estimateBusinessSize — small / medium / large
 * Based on reviews_count + name patterns (franchise/chain keywords)
 */
const CHAIN_KEYWORDS = /\b(group|national|corp|inc|franchise|chain|holdings|enterprises|international|worldwide|global|brands|partners|associates|network)\b/i;

function estimateBusinessSize(lead) {
  const name = lead.name || "";
  const reviews = lead.reviews_count ?? 0;

  // Name-based: franchise/chain keywords → large
  if (CHAIN_KEYWORDS.test(name)) return "large";

  // Reviews-based thresholds
  if (reviews > 500)  return "large";
  if (reviews > 100)  return "medium";
  return "small";
}

module.exports = { isRealEmail, classifyEmail, estimateBusinessSize };
