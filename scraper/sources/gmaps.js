const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");
const { slugify, cleanBusinessName } = require("../utils/slugify");
const { isRealEmail, estimateBusinessSize } = require("../utils/email");
const { normalizePhone } = require("../utils/phone");
const { upsertLead } = require("../utils/dedup");
const { mineReviewPain } = require("../enrichment/review-pain");
const { countRecent } = require("../utils/relative-date");

chromium.use(stealth());

const GMAPS_SEARCH = "https://www.google.com/maps/search/";

function buildSearchUrl(category, city, country) {
  const query = `${category} ${city} ${country}`;
  return `${GMAPS_SEARCH}${encodeURIComponent(query)}`;
}

async function scrollResults(page) {
  const feed = page.locator('div[role="feed"]');
  const exists = await feed.count();
  if (!exists) return;

  let prevCount = 0;
  let staleRounds = 0;

  for (let i = 0; i < 50; i++) {
    await feed.evaluate((el) => el.scrollBy(0, 3000));
    await page.waitForTimeout(1500);

    const endMarker = await page.locator("span.HlvSq").count();
    if (endMarker > 0) break;

    const currentCount = await page.locator('div[role="feed"] > div > div > a').count();
    if (currentCount === prevCount) {
      staleRounds++;
      if (staleRounds >= 5) break;
    } else {
      staleRounds = 0;
    }
    prevCount = currentCount;
  }
}

async function extractResults(page) {
  return page.evaluate(() => {
    const items = document.querySelectorAll('div[role="feed"] > div > div > a');
    const results = [];

    for (const a of items) {
      const href = a.getAttribute("href") || "";
      if (!href.includes("/maps/place/")) continue;

      const label = a.getAttribute("aria-label") || "";
      if (!label) continue;

      results.push({ name: label, url: href });
    }

    return results;
  });
}

async function extractDetail(page) {
  await page.waitForTimeout(800);

  // Wait for URL to contain coordinates (@lat,lng)
  for (let i = 0; i < 6; i++) {
    if (/@-?\d+\.\d+,-?\d+\.\d+/.test(page.url())) break;
    await page.waitForTimeout(500);
  }

  return page.evaluate(() => {
    const getText = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : null;
    };

    const getAttr = (sel, attr) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute(attr) : null;
    };

    const buttons = document.querySelectorAll('button[data-item-id]');
    let phone = null;
    let address = null;
    let website = null;
    let email = null;

    for (const btn of buttons) {
      const itemId = btn.getAttribute("data-item-id") || "";
      const text = btn.textContent.trim();

      if (itemId.startsWith("phone:")) {
        phone = itemId.replace("phone:tel:", "").replace("phone:", "");
      } else if (itemId === "address") {
        address = text;
      } else if (itemId.includes("@") && /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,6}$/i.test(itemId)) {
        email = itemId.toLowerCase();
      }
    }

    // Fallback: check mailto links
    if (!email) {
      const mailtoLink = document.querySelector('a[href^="mailto:"]');
      if (mailtoLink) {
        const mailto = mailtoLink.getAttribute("href").replace("mailto:", "").split("?")[0].trim().toLowerCase();
        if (/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,6}$/i.test(mailto)) {
          email = mailto;
        }
      }
    }

    const websiteLink = document.querySelector('a[data-item-id="authority"]');
    if (websiteLink) {
      website = websiteLink.getAttribute("href");
    }

    let rating = null;
    let reviewsCount = null;
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
    if (ratingEl) {
      rating = parseFloat(ratingEl.textContent);
    }
    const reviewsEl = document.querySelector('div.F7nice span[aria-label*="review"]');
    if (reviewsEl) {
      const m = reviewsEl.getAttribute("aria-label").match(/([\d,]+)/);
      if (m) reviewsCount = parseInt(m[1].replace(/,/g, ""));
    }

    let category = null;
    const catEl = document.querySelector('button[jsaction*="category"]');
    if (catEl) category = catEl.textContent.trim();

    let hours = null;
    const hoursEl = document.querySelector('div[aria-label*="hour"] span.ZDu9vd');
    if (hoursEl) hours = hoursEl.textContent.trim();

    const coordsMatch = window.location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    let lat = null, lng = null;
    if (coordsMatch) {
      lat = parseFloat(coordsMatch[1]);
      lng = parseFloat(coordsMatch[2]);
    }

    // ── Visible review snippets (module #3: review-pain input) ──
    const reviews_text = Array.from(document.querySelectorAll("span.wiI7pd"))
      .map((el) => el.textContent.trim())
      .filter(Boolean)
      .slice(0, 8);

    // ── Visible review dates (Tier-1 #2: recent-activity floor) ──
    const reviews_dates = Array.from(document.querySelectorAll("span.rsqaWe"))
      .map((el) => el.textContent.trim())
      .filter(Boolean)
      .slice(0, 10);

    // ── Venue photos (demo templates). Google serves thumbnails; bump the
    // size param to get hi-res for free. /p/ and gps-cs = place photos;
    // /a/ paths are reviewer avatars and are excluded. ──
    const photos = Array.from(document.querySelectorAll("img"))
      .map((el) => el.src || "")
      .filter((src) => /googleusercontent\.com\/(p\/|gps-cs)/.test(src))
      .map((src) => src.replace(/=[sw]\d+[^"']*$/, "=w1600-h900"))
      .filter((src, i, a) => a.indexOf(src) === i)
      .slice(0, 12);

    return {
      phone,
      address,
      website,
      email,
      rating,
      reviews_count: reviewsCount,
      category_raw: category,
      opening_hours: hours,
      lat,
      lng,
      reviews_text,
      reviews_dates,
      photos,
    };
  });
}

async function run(job, supabase) {
  const { category, city, country } = job.params;

  if (!category || !city || !country) {
    throw new Error("Params manquants : category, city, country requis");
  }

  console.log(`  🗺️  GMaps → ${category} à ${city}, ${country}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    const url = buildSearchUrl(category, city, country);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const consentBtn = page.locator('button[aria-label="Accept all"]');
    if (await consentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await consentBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1000);

    await scrollResults(page);

    const allListings = await extractResults(page);
    const maxResults = job.params.maxResults ?? allListings.length;
    const listings = allListings.slice(0, maxResults);
    console.log(`  📍 ${allListings.length} résultats GMaps trouvés (limit: ${maxResults})`);

    const WORKSPACE_ID = job.workspace_id;
    let inserted = 0;
    let skipped = 0;

    for (const listing of listings) {
      const slug = slugify(cleanBusinessName(listing.name));
      if (!slug) { skipped++; continue; }

      try {
        await page.goto(listing.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        const detail = await extractDetail(page);

        const phone = detail.phone ? normalizePhone(detail.phone) : null;
        const gmapsEmail = detail.email && isRealEmail(detail.email) ? detail.email : null;
        if (!phone && !detail.website && !gmapsEmail) { skipped++; continue; }

        const { review_pain, review_pain_quotes } = mineReviewPain(detail.reviews_text || []);
        // Conservative floor: recent reviews visible on the panel (relevance-sorted,
        // so this under-counts — never over-claims activity).
        const review_velocity = countRecent(detail.reviews_dates || [], 3);

        const lead = {
          workspace_id: WORKSPACE_ID,
          slug,
          name: listing.name,
          category,
          category_raw: detail.category_raw,
          country,
          city,
          address: detail.address,
          lat: detail.lat,
          lng: detail.lng,
          phone,
          phone_raw: detail.phone,
          email: gmapsEmail,
          website: detail.website,
          has_website: !!detail.website,
          // When the GMB "website" slot is actually a Facebook page, capture it
          // as the social handle too — the fb_website module then digs the real
          // site out of that page instead of us flagging a fake "no website".
          facebook: /facebook\.com\//i.test(detail.website || "") ? detail.website : null,
          rating: detail.rating,
          reviews_count: detail.reviews_count,
          opening_hours: detail.opening_hours,
          sources: ["gmaps"],
          business_size: estimateBusinessSize({ name: listing.name, reviews_count: detail.reviews_count }),
          review_pain,
          review_pain_quotes: review_pain_quotes.length ? review_pain_quotes : null,
          review_velocity,
          // Demo assets (photos + guest quotes) — opt-in via params.photos,
          // needs migration 014 applied.
          ...(job.params.photos
            ? {
                photos: detail.photos && detail.photos.length ? detail.photos : null,
                hero_image: detail.photos && detail.photos.length ? detail.photos[0] : null,
                reviews_text: detail.reviews_text && detail.reviews_text.length ? detail.reviews_text : null,
              }
            : {}),
          enrichment_status: "pending",
          scraped_at: new Date().toISOString(),
        };

        if (job.params.noWebsiteOnly && lead.website) { skipped++; continue; }
        if (job.params.requireEmail && !lead.email) { skipped++; continue; }

        const result = await upsertLead(supabase, WORKSPACE_ID, lead, "gmaps");
        if (result.action === "inserted") {
          inserted++;
          const emailTag = gmapsEmail ? ` 📧 ${gmapsEmail}` : "";
          console.log(`    ✅  ${listing.name.padEnd(40)} → /${slug}${emailTag}`);
        } else if (result.action === "merged") {
          inserted++;
          const emailTag = gmapsEmail ? ` 📧 ${gmapsEmail}` : "";
          console.log(`    🔄  ${listing.name.padEnd(40)} → merged (${result.reason})${emailTag}`);
        } else if (result.action === "error") {
          console.error(`    ⚠️  ${listing.name} : ${result.reason}`);
        }
      } catch (err) {
        console.error(`    ❌  ${listing.name} : ${err.message}`);
        skipped++;
      }

      await supabase.from("jobs").update({
        progress: { found: inserted, total: listings.length },
      }).eq("id", job.id);

      await page.waitForTimeout(300 + Math.random() * 700);
    }

    console.log(`\n  📊 GMaps terminé : ${inserted} insérés/mis à jour, ${skipped} ignorés`);
    return { inserted, total: listings.length };
  } finally {
    await browser.close();
  }
}

module.exports = { run };
