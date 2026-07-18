const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");
const { slugify, cleanBusinessName } = require("../utils/slugify");
const { normalizePhone } = require("../utils/phone");
const { upsertLead } = require("../utils/dedup");

chromium.use(stealth());

// WORKSPACE_ID is read from job.workspace_id in run()

function buildSearchUrl(category, city, page = 1) {
  const loc = `${city}`.toLowerCase().replace(/\s+/g, "-");
  const cat = `${category}`.toLowerCase().replace(/\s+/g, "-");
  const base = `https://www.yellowpages.com/${encodeURIComponent(loc)}/${encodeURIComponent(cat)}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

async function extractListings(page) {
  return page.evaluate(() => {
    const cards = document.querySelectorAll('.result');
    const results = [];

    for (const card of cards) {
      const nameEl = card.querySelector('.business-name a, a.business-name');
      if (!nameEl) continue;

      const name = nameEl.textContent.trim();
      const href = nameEl.getAttribute("href");
      if (!name || !href) continue;

      let phone = null;
      const phoneEl = card.querySelector('.phones.phone-primary');
      if (phoneEl) phone = phoneEl.textContent.trim();

      let address = null;
      const streetEl = card.querySelector('.street-address');
      const localityEl = card.querySelector('.locality');
      const parts = [];
      if (streetEl) parts.push(streetEl.textContent.trim());
      if (localityEl) parts.push(localityEl.textContent.trim());
      if (parts.length > 0) address = parts.join(", ");

      let website = null;
      const webEl = card.querySelector('a.track-visit-website');
      if (webEl) website = webEl.getAttribute("href");

      let rating = null;
      const ratingEl = card.querySelector('.ratings .rating-star');
      if (ratingEl) {
        const cls = ratingEl.className;
        const m = cls.match(/(\d+)/);
        if (m) rating = parseInt(m[1]) / 2;
      }

      let reviewsCount = null;
      const countEl = card.querySelector('.ratings .count');
      if (countEl) {
        const m = countEl.textContent.match(/(\d+)/);
        if (m) reviewsCount = parseInt(m[1]);
      }

      let category_raw = null;
      const catEl = card.querySelector('.categories a');
      if (catEl) category_raw = catEl.textContent.trim();

      results.push({
        name,
        url: href.startsWith("http") ? href : `https://www.yellowpages.com${href}`,
        phone,
        address,
        website,
        rating,
        reviews_count: reviewsCount,
        category_raw,
      });
    }

    return results;
  });
}

async function extractDetailCoords(page) {
  await page.waitForTimeout(600);

  return page.evaluate(() => {
    let lat = null, lng = null;

    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const text = s.textContent || "";
      const latM = text.match(/latitude['":\s]+([-\d.]+)/);
      const lngM = text.match(/longitude['":\s]+([-\d.]+)/);
      if (latM && lngM) {
        lat = parseFloat(latM[1]);
        lng = parseFloat(lngM[1]);
        break;
      }
    }

    if (!lat) {
      const mapEl = document.querySelector('[data-lat], [data-latitude]');
      if (mapEl) {
        lat = parseFloat(mapEl.getAttribute("data-lat") || mapEl.getAttribute("data-latitude"));
        lng = parseFloat(mapEl.getAttribute("data-lng") || mapEl.getAttribute("data-longitude"));
      }
    }

    let website = null;
    const webLink = document.querySelector('a.website-link, a[href*="://"][rel="nofollow"]');
    if (webLink) website = webLink.getAttribute("href");

    return { lat, lng, website };
  });
}

async function run(job, supabase) {
  const WORKSPACE_ID = job.workspace_id;
  const { category, city, country } = job.params;
  if (!category || !city) {
    throw new Error("Params manquants : category, city requis");
  }

  console.log(`  📒 YellowPages → ${category} à ${city}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-US",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    const maxResults = job.params.maxResults ?? 100;
    let allListings = [];

    for (let p = 1; p <= 10; p++) {
      const url = buildSearchUrl(category, city, p);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1000);

      const listings = await extractListings(page);
      if (listings.length === 0) break;
      allListings.push(...listings);
      console.log(`    📄 Page ${p}: ${listings.length} résultats`);

      if (allListings.length >= maxResults) break;
      await page.waitForTimeout(500 + Math.random() * 1000);
    }

    allListings = allListings.slice(0, maxResults);
    console.log(`  📍 ${allListings.length} résultats YellowPages (limit: ${maxResults})`);

    let inserted = 0;
    let skipped = 0;

    for (const listing of allListings) {
      const slug = slugify(cleanBusinessName(listing.name));
      if (!slug) { skipped++; continue; }

      try {
        let lat = null, lng = null;
        let website = listing.website;

        try {
          await page.goto(listing.url, { waitUntil: "domcontentloaded", timeout: 15000 });
          const detail = await extractDetailCoords(page);
          lat = detail.lat;
          lng = detail.lng;
          if (!website && detail.website) website = detail.website;
        } catch {}

        const phone = normalizePhone(listing.phone);

        const lead = {
          workspace_id: WORKSPACE_ID,
          slug,
          name: listing.name,
          category,
          category_raw: listing.category_raw,
          country: country || "US",
          city,
          address: listing.address,
          lat,
          lng,
          phone,
          phone_raw: listing.phone,
          website,
          has_website: !!website,
          rating: listing.rating,
          reviews_count: listing.reviews_count,
          sources: ["yellowpages"],
          enrichment_status: "pending",
          scraped_at: new Date().toISOString(),
        };

        if (job.params.noWebsiteOnly && lead.website) { skipped++; continue; }
        if (job.params.requireEmail && !lead.email) { skipped++; continue; }

        const result = await upsertLead(supabase, WORKSPACE_ID, lead, "yellowpages");
        if (result.action === "inserted") {
          inserted++;
          console.log(`    ✅  ${listing.name.padEnd(40)} → /${slug}`);
        } else if (result.action === "merged") {
          inserted++;
          console.log(`    🔄  ${listing.name.padEnd(40)} → merged (${result.reason})`);
        } else if (result.action === "error") {
          console.error(`    ⚠️  ${listing.name} : ${result.reason}`);
        }
      } catch (err) {
        console.error(`    ❌  ${listing.name} : ${err.message}`);
        skipped++;
      }

      await supabase.from("jobs").update({
        progress: { found: inserted, total: allListings.length },
      }).eq("id", job.id);

      await page.waitForTimeout(300 + Math.random() * 700);
    }

    console.log(`\n  📊 YellowPages terminé : ${inserted} insérés/mis à jour, ${skipped} ignorés`);
    return { inserted, total: allListings.length };
  } finally {
    await browser.close();
  }
}

module.exports = { run };
