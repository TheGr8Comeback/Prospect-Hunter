// ── Deduplication cross-sources ──────────────────────────────
// Trouve un lead existant par phone, domaine website, ou similarite de nom.
// Fusionne les donnees si doublon detecte.

const { slugify } = require("./slugify");

// ── Helpers ────────────────────────────────────────────────

// Extract last 10 digits of a phone for comparison
function phoneDigits(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

// Extract domain from website URL
function extractDomain(website) {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Jaccard similarity on normalized name words
function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const strip = (s) =>
    s.toLowerCase()
      .replace(/\b(llc|inc|corp|co|ltd|company|the|and|of)\b/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  const wordsA = strip(a);
  const wordsB = strip(b);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

// ── Find existing lead ─────────────────────────────────────

async function findExistingLead(supabase, workspaceId, candidate) {
  // 1. Exact slug match
  const slug = slugify(candidate.name);
  if (slug) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("slug", slug)
      .single();
    if (data) return { match: data, reason: "slug" };
  }

  // 2. Same phone (last 10 digits)
  const digits = phoneDigits(candidate.phone);
  if (digits) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .not("phone", "is", null);

    if (data) {
      const match = data.find((l) => phoneDigits(l.phone) === digits);
      if (match) return { match, reason: "phone" };
    }
  }

  // 3. Same website domain
  const domain = extractDomain(candidate.website);
  if (domain && domain.length > 3) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .not("website", "is", null)
      .ilike("website", `%${domain}%`);

    if (data && data.length === 1) return { match: data[0], reason: "domain" };
  }

  // 4. High name similarity + same city
  if (candidate.city && candidate.name) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("city", candidate.city)
      .limit(200);

    if (data) {
      for (const existing of data) {
        if (nameSimilarity(candidate.name, existing.name) >= 0.6) {
          return { match: existing, reason: "name" };
        }
      }
    }
  }

  return null;
}

// ── Merge incoming data into existing lead ──────────────────

function mergeLead(existing, incoming, source) {
  const merged = {};

  // Merge sources
  merged.sources = [...new Set([...(existing.sources || []), source])];

  // Fill missing fields from incoming (don't overwrite existing data)
  const fillable = [
    "phone", "phone_raw", "email", "email_type", "website", "address", "postal_code",
    "opening_hours", "lat", "lng", "region", "business_size", "facebook",
  ];
  for (const field of fillable) {
    if (!existing[field] && incoming[field]) {
      merged[field] = incoming[field];
    }
  }

  // Keep better rating / reviews
  if (incoming.rating && (!existing.rating || incoming.rating > existing.rating)) {
    merged.rating = incoming.rating;
  }
  if (incoming.reviews_count && (!existing.reviews_count || incoming.reviews_count > existing.reviews_count)) {
    merged.reviews_count = incoming.reviews_count;
  }

  // has_website
  if (incoming.has_website && !existing.has_website) {
    merged.has_website = true;
  }

  // Re-enrich with new data
  merged.enrichment_status = "pending";

  return merged;
}

// ── Unified upsert for all scrapers ─────────────────────────

async function upsertLead(supabase, workspaceId, leadData, source) {
  const slug = slugify(leadData.name);
  if (!slug) return { action: "skipped", reason: "no slug" };

  const existing = await findExistingLead(supabase, workspaceId, leadData);

  if (existing) {
    const updates = mergeLead(existing.match, leadData, source);
    const { error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", existing.match.id);

    if (error) return { action: "error", reason: error.message };
    return { action: "merged", reason: existing.reason, name: existing.match.name };
  }

  // New lead — insert
  const { error } = await supabase
    .from("leads")
    .insert({
      ...leadData,
      slug,
      workspace_id: workspaceId,
      sources: [source],
    });

  if (error) return { action: "error", reason: error.message };
  return { action: "inserted", name: leadData.name };
}

module.exports = {
  findExistingLead,
  mergeLead,
  upsertLead,
  nameSimilarity,
  extractDomain,
  phoneDigits,
};
