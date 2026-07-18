/**
 * osm.js — Scraping via Overpass API (OpenStreetMap)
 * HTTP pur, pas de browser nécessaire.
 *
 * Overpass QL reference : https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
 */

const https          = require("https");
const { URL }        = require("url");
const { slugify, cleanBusinessName } = require("../utils/slugify");
const { isRealEmail, classifyEmail, estimateBusinessSize } = require("../utils/email");
const { normalizePhone } = require("../utils/phone");
const { upsertLead } = require("../utils/dedup");

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function postOverpass(endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      family: 4,          // Force IPv4 — IPv6 timeouts on some Overpass mirrors
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "Accept": "*/*",
        "User-Agent": "ProspectOS/1.0",
      },
      timeout: 45_000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Mapping catégorie → tags OSM
const CATEGORY_TAGS = {
  hvac:        [{ amenity: "hvac" }, { craft: "hvac" }, { craft: "heating_engineer" }],
  dentist:     [{ amenity: "dentist" }, { healthcare: "dentist" }],
  plumber:     [{ craft: "plumber" }, { amenity: "plumber" }],
  electrician: [{ craft: "electrician" }],
  painter:     [{ craft: "painter" }, { craft: "plasterer" }],
  restaurant:  [{ amenity: "restaurant" }],
  gym:         [{ leisure: "fitness_centre" }, { leisure: "sports_centre" }],
};

/**
 * Construit la requête Overpass QL pour une ville/pays
 */
function buildQuery(category, city, country, { noWebsiteOnly = false, requireEmail = false } = {}) {
  const tags = CATEGORY_TAGS[category] ?? [{ name: category }];

  // Filtres opt-in appliqués côté serveur Overpass (vide par défaut → requête inchangée)
  const extra =
    (noWebsiteOnly ? `[!"website"][!"contact:website"][!"url"]` : "") +
    (requireEmail  ? `[~"^(email|contact:email)$"~"."]` : "");

  // Construire les unions de tags
  const nodeQueries = tags.map(tag => {
    const entries = Object.entries(tag);
    const filter  = entries.map(([k, v]) => `["${k}"="${v}"]`).join("");
    return `node${filter}${extra}(area.city);`;
  });
  const wayQueries = tags.map(tag => {
    const entries = Object.entries(tag);
    const filter  = entries.map(([k, v]) => `["${k}"="${v}"]`).join("");
    return `way${filter}${extra}(area.city);`;
  });

  return `
    [out:json][timeout:60];
    area["ISO3166-1"="${country}"]->.country;
    area["name"="${city}"](area.country)->.city;
    (
      ${nodeQueries.join("\n      ")}
      ${wayQueries.join("\n      ")}
    );
    out body center;
  `;
}

/**
 * Extrait les données d'un élément OSM et retourne un objet lead partiel
 */
function parseElement(el, category, city, country) {
  const tags = el.tags ?? {};

  const name = tags.name || tags["name:en"];
  if (!name) return null;

  // Coordonnées (node direct ou centroid de way)
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;

  // Phone
  const phoneRaw = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || null;
  const phone    = phoneRaw ? normalizePhone(phoneRaw) : null;

  // Website
  const website = tags.website || tags["contact:website"] || tags.url || null;

  // Email
  const emailRaw  = tags.email || tags["contact:email"] || null;
  const email     = emailRaw && isRealEmail(emailRaw) ? emailRaw.toLowerCase() : null;

  // Opening hours
  const openingHours = tags.opening_hours || null;

  // Adresse
  const street  = tags["addr:street"]  || null;
  const housenr = tags["addr:housenumber"] || null;
  const postal  = tags["addr:postcode"] || null;
  const addrCity = tags["addr:city"]   || city;
  const address  = [housenr, street, postal, addrCity].filter(Boolean).join(", ") || null;

  const slug = slugify(cleanBusinessName(name));
  if (!slug) return null;

  const lead = {
    slug,
    name,
    category,
    category_raw: Object.entries(el.tags).find(([k]) => k !== "name")?.[0]
      ? Object.entries(el.tags).map(([k,v]) => `${k}=${v}`).join(";")
      : null,
    country,
    city,
    address,
    postal_code:   postal,
    lat,
    lng,
    phone,
    phone_raw:     phoneRaw,
    website,
    has_website:   !!website,
    email,
    email_type:    classifyEmail(email),
    opening_hours: openingHours,
    sources:       ["osm"],
    enrichment_status: "pending",
    scraped_at:    new Date().toISOString(),
  };
  lead.business_size = estimateBusinessSize(lead);
  return lead;
}

/**
 * Handler principal — appelé par le worker
 */
async function run(job, supabase) {
  const { category, city, country } = job.params;

  if (!category || !city || !country) {
    throw new Error("Params manquants : category, city, country requis");
  }

  const { noWebsiteOnly = false, requireEmail = false } = job.params;
  const filterTag = [noWebsiteOnly && "no-website", requireEmail && "email"].filter(Boolean).join("+");
  console.log(`  🌍 OSM → ${category} à ${city}, ${country}${filterTag ? `  [${filterTag}]` : ""}`);

  const query = buildQuery(category, city, country, { noWebsiteOnly, requireEmail });
  const body  = `data=${encodeURIComponent(query)}`;

  let json;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      json = await postOverpass(endpoint, body);
      console.log(`  ✓ ${endpoint}`);
      break;
    } catch (err) {
      console.warn(`  ⚠️  ${endpoint} → ${err.message}, fallback…`);
    }
  }

  if (!json) {
    throw new Error("Tous les endpoints Overpass ont échoué");
  }

  const allElements = json.elements ?? [];
  const maxResults = job.params.maxResults ?? allElements.length;
  const elements = allElements.slice(0, maxResults);

  console.log(`  📍 ${allElements.length} éléments OSM trouvés (limit: ${maxResults})`);

  let inserted = 0;
  let skipped  = 0;

  const WORKSPACE_ID = job.workspace_id;

  for (const el of elements) {
    const lead = parseElement(el, category, city, country);
    if (!lead) { skipped++; continue; }
    if (!lead.phone && !lead.email) { skipped++; continue; }
    // Filtres opt-in (sécurité — OSM filtre déjà côté serveur quand activé)
    if (noWebsiteOnly && lead.website) { skipped++; continue; }
    if (requireEmail && !lead.email) { skipped++; continue; }

    try {
      const result = await upsertLead(supabase, WORKSPACE_ID, lead, "osm");
      if (result.action === "inserted") {
        inserted++;
        console.log(`    ✅  ${lead.name.padEnd(40)} → /${lead.slug}`);
      } else if (result.action === "merged") {
        inserted++;
        console.log(`    🔄  ${lead.name.padEnd(40)} → merged (${result.reason})`);
      } else if (result.action === "error") {
        console.error(`    ⚠️  ${lead.name} : ${result.reason}`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`    ❌  ${lead.name} : ${err.message}`);
    }

    await supabase.from("jobs").update({
      progress: { found: inserted, total: elements.length },
    }).eq("id", job.id);
  }

  console.log(`\n  📊 OSM terminé : ${inserted} insérés/fusionnés, ${skipped} ignorés`);
  return { inserted, total: elements.length };
}

module.exports = { run };
