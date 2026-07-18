const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");
const { slugify, cleanBusinessName } = require("../utils/slugify");
const { normalizePhone } = require("../utils/phone");
const { upsertLead } = require("../utils/dedup");

chromium.use(stealth());

// WORKSPACE_ID is read from job.workspace_id in run()

function buildSearchUrl(category, city, country, page = 1) {
  const loc = `${city}, ${country}`;
  const base = `https://www.bbb.org/search?find_text=${encodeURIComponent(category)}&find_loc=${encodeURIComponent(loc)}&page=${page}`;
  return base;
}

async function extractListings(page) {
  return page.evaluate(() => {
    const cards = document.querySelectorAll('[data-testid="search-result"], .MuiStack-root a[href*="/profile/"], .result-item, [class*="SearchResult"]');
    const results = [];

    const allLinks = document.querySelectorAll('a[href*="/profile/"]');
    const seen = new Set();

    for (const a of allLinks) {
      const href = a.getAttribute("href");
      if (!href || seen.has(href)) continue;
      seen.add(href);

      const container = a.closest('[class*="Stack"], [class*="result"], div') || a;
      const name = a.textContent.trim().replace(/\s+/g, " ");
      if (!name || name.length < 2 || name.length > 100) continue;

      let phone = null;
      const phoneMatch = container.textContent.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
      if (phoneMatch) phone = phoneMatch[0];

      let address = null;
      const addrParts = container.textContent.match(/\d+\s+[A-Z][a-zA-Z\s]+(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pl|Pkwy|Hwy)[.,]?\s*(?:#?\w+)?,?\s*[A-Z][a-z]+/);
      if (addrParts) address = addrParts[0].trim();

      let rating = null;
      const ratingMatch = container.textContent.match(/(\d+\.?\d*)\s*\/\s*5/);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);

      let reviewsCount = null;
      const reviewMatch = container.textContent.match(/(\d+)\s*(?:reviews?|complaints?)/i);
      if (reviewMatch) reviewsCount = parseInt(reviewMatch[1]);

      results.push({
        name: name.split("\n")[0].trim(),
        url: href.startsWith("http") ? href : `https://www.bbb.org${href}`,
        phone,
        address,
        rating,
        reviews_count: reviewsCount,
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
    let lat = null, lng = null;
    let rating = null;
    let category_raw = null;

    const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
    if (phoneLinks.length > 0) {
      phone = phoneLinks[0].getAttribute("href").replace("tel:", "");
    }

    const webLinks = document.querySelectorAll('a[href*="://"]');
    for (const a of webLinks) {
      const href = a.getAttribute("href") || "";
      if (href.includes("bbb.org")) continue;
      if (href.includes("google") || href.includes("facebook") || href.includes("yelp")) continue;
      if (href.startsWith("http") && a.textContent.trim().toLowerCase().includes("visit website")) {
        website = href;
        break;
      }
    }

    if (!website) {
      for (const a of webLinks) {
        const href = a.getAttribute("href") || "";
        const text = a.textContent.trim().toLowerCase();
        if (href.startsWith("http") && !href.includes("bbb.org") && !href.includes("google") && !href.includes("mailto:") && (text.includes("website") || text.includes("www") || text.includes(".com"))) {
          website = href;
          break;
        }
      }
    }

    const addrEl = document.querySelector('address, [class*="address"], [data-testid*="address"]');
    if (addrEl) address = addrEl.textContent.trim().replace(/\s+/g, " ");

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const json = JSON.parse(s.textContent);
        const biz = json["@type"] === "LocalBusiness" ? json : (json.mainEntity || json);
        if (biz.geo) {
          lat = parseFloat(biz.geo.latitude);
          lng = parseFloat(biz.geo.longitude);
        }
        if (biz.telephone) phone = biz.telephone;
        if (biz.url && !biz.url.includes("bbb.org")) website = biz.url;
        if (biz.address) {
          address = [biz.address.streetAddress, biz.address.addressLocality, biz.address.addressRegion, biz.address.postalCode].filter(Boolean).join(", ");
        }
        if (biz.aggregateRating) {
          rating = parseFloat(biz.aggregateRating.ratingValue);
        }
        if (biz["@type"] && biz["@type"] !== "LocalBusiness") {
          category_raw = biz["@type"];
        }
      } catch {}
    }

    const catEl = document.querySelector('[class*="category"], [class*="type"]');
    if (catEl && !category_raw) category_raw = catEl.textContent.trim();

    return { phone, website, address, lat, lng, rating, category_raw };
  });
}

async function run(job, supabase) {
  const WORKSPACE_ID = job.workspace_id;
  const { category, city, country } = job.params;
  if (!category || !city) {
    throw new Error("Params manquants : category, city requis");
  }

  console.log(`  🏛️  BBB → ${category} à ${city}, ${country || "US"}`);

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
      const url = buildSearchUrl(category, city, country || "US", p);
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
    console.log(`  📍 ${allListings.length} résultats BBB (limit: ${maxResults})`);

    let inserted = 0;
    let skipped = 0;

    for (const listing of allListings) {
      const slug = slugify(cleanBusinessName(listing.name));
      if (!slug) { skipped++; continue; }

      try {
        await page.goto(listing.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        const detail = await extractBizDetail(page);

        const phone = normalizePhone(detail.phone || listing.phone);
        const website = detail.website;

        const lead = {
          workspace_id: WORKSPACE_ID,
          slug,
          name: listing.name,
          category,
          category_raw: detail.category_raw,
          country: country || "US",
          city,
          address: detail.address || listing.address,
          lat: detail.lat,
          lng: detail.lng,
          phone,
          phone_raw: detail.phone || listing.phone,
          website,
          has_website: !!website,
          rating: detail.rating || listing.rating,
          reviews_count: listing.reviews_count,
          sources: ["bbb"],
          enrichment_status: "pending",
          scraped_at: new Date().toISOString(),
        };

        if (job.params.noWebsiteOnly && lead.website) { skipped++; continue; }
        if (job.params.requireEmail && !lead.email) { skipped++; continue; }

        const result = await upsertLead(supabase, WORKSPACE_ID, lead, "bbb");
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

    console.log(`\n  📊 BBB terminé : ${inserted} insérés/mis à jour, ${skipped} ignorés`);
    return { inserted, total: allListings.length };
  } finally {
    await browser.close();
  }
}

module.exports = { run };
