const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");
const { slugify, cleanBusinessName } = require("../utils/slugify");
const { normalizePhone } = require("../utils/phone");
const { upsertLead } = require("../utils/dedup");

chromium.use(stealth());

// WORKSPACE_ID is read from job.workspace_id in run()

function buildSearchUrl(category, city, country, start = 0) {
  const loc = `${city}, ${country}`;
  const base = `https://www.yelp.com/search?find_desc=${encodeURIComponent(category)}&find_loc=${encodeURIComponent(loc)}`;
  return start > 0 ? `${base}&start=${start}` : base;
}

async function extractListings(page) {
  return page.evaluate(() => {
    const cards = document.querySelectorAll('[data-testid="serp-ia-card"]');
    const results = [];

    for (const card of cards) {
      const linkEl = card.querySelector('a[href*="/biz/"]');
      if (!linkEl) continue;

      const name = linkEl.textContent.trim().replace(/^\d+\.\s*/, "");
      const href = linkEl.getAttribute("href");
      if (!name || !href) continue;

      let rating = null;
      const ratingEl = card.querySelector('[aria-label*="star rating"]');
      if (ratingEl) {
        const m = ratingEl.getAttribute("aria-label").match(/([\d.]+)/);
        if (m) rating = parseFloat(m[1]);
      }

      let reviewsCount = null;
      const reviewEl = card.querySelector('span[class*="css-"]');
      if (reviewEl) {
        const m = reviewEl.textContent.match(/(\d+)\s*review/i);
        if (m) reviewsCount = parseInt(m[1]);
      }

      let category = null;
      const catLinks = card.querySelectorAll('a[href*="/search?find_desc"]');
      if (catLinks.length > 0) {
        category = Array.from(catLinks).map((a) => a.textContent.trim()).join(", ");
      }

      let phone = null;
      const phoneMatch = card.textContent.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      if (phoneMatch) phone = phoneMatch[0];

      let address = null;
      const addrEl = card.querySelector('[class*="secondaryAttributes"]');
      if (addrEl) address = addrEl.textContent.trim();

      results.push({
        name,
        url: href.startsWith("http") ? href : `https://www.yelp.com${href}`,
        rating,
        reviews_count: reviewsCount,
        category_raw: category,
        phone,
        address,
      });
    }

    return results;
  });
}

async function extractBizDetail(page) {
  await page.waitForTimeout(800);

  return page.evaluate(() => {
    let phone = null;
    let website = null;
    let address = null;

    const sidebarLinks = document.querySelectorAll('aside a, [class*="sidebar"] a');
    for (const a of sidebarLinks) {
      const href = a.getAttribute("href") || "";
      if (href.startsWith("/biz_redir")) {
        const url = new URL(href, window.location.origin);
        website = url.searchParams.get("url") || href;
      }
    }

    const allText = document.body.innerText;
    const phoneMatch = allText.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (phoneMatch) phone = phoneMatch[0];

    const addrEl = document.querySelector('address, [class*="address"]');
    if (addrEl) address = addrEl.textContent.trim();

    const mapLink = document.querySelector('a[href*="maps.google.com"]');
    let lat = null, lng = null;
    if (mapLink) {
      const m = mapLink.getAttribute("href").match(/q=([-\d.]+),([-\d.]+)/);
      if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
    }

    if (!lat) {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const json = JSON.parse(s.textContent);
          if (json.geo) {
            lat = parseFloat(json.geo.latitude);
            lng = parseFloat(json.geo.longitude);
          }
        } catch {}
      }
    }

    return { phone, website, address, lat, lng };
  });
}

async function run(job, supabase) {
  const WORKSPACE_ID = job.workspace_id;
  const { category, city, country } = job.params;
  if (!category || !city || !country) {
    throw new Error("Params manquants : category, city, country requis");
  }

  console.log(`  🟡 Yelp → ${category} à ${city}, ${country}`);

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

    for (let start = 0; start < 10; start++) {
      const url = buildSearchUrl(category, city, country, start * 10);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1000);

      const listings = await extractListings(page);
      if (listings.length === 0) break;
      allListings.push(...listings);
      console.log(`    📄 Page ${start + 1}: ${listings.length} résultats`);

      if (allListings.length >= maxResults) break;
      await page.waitForTimeout(500 + Math.random() * 1000);
    }

    allListings = allListings.slice(0, maxResults);
    console.log(`  📍 ${allListings.length} résultats Yelp (limit: ${maxResults})`);

    let inserted = 0;
    let skipped = 0;

    for (const listing of allListings) {
      const slug = slugify(cleanBusinessName(listing.name));
      if (!slug) { skipped++; continue; }

      try {
        await page.goto(listing.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const detail = await extractBizDetail(page);

        const phone = normalizePhone(detail.phone || listing.phone);
        const website = detail.website;

        const lead = {
          workspace_id: WORKSPACE_ID,
          slug,
          name: listing.name,
          category,
          category_raw: listing.category_raw,
          country,
          city,
          address: detail.address || listing.address,
          lat: detail.lat,
          lng: detail.lng,
          phone,
          phone_raw: detail.phone || listing.phone,
          website,
          has_website: !!website,
          rating: listing.rating,
          reviews_count: listing.reviews_count,
          sources: ["yelp"],
          enrichment_status: "pending",
          scraped_at: new Date().toISOString(),
        };

        if (job.params.noWebsiteOnly && lead.website) { skipped++; continue; }
        if (job.params.requireEmail && !lead.email) { skipped++; continue; }

        const result = await upsertLead(supabase, WORKSPACE_ID, lead, "yelp");
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

    console.log(`\n  📊 Yelp terminé : ${inserted} insérés/mis à jour, ${skipped} ignorés`);
    return { inserted, total: allListings.length };
  } finally {
    await browser.close();
  }
}

module.exports = { run };
