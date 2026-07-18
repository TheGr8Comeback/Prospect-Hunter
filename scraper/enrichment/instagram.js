/**
 * Instagram email scraper for leads without websites.
 *
 * Flow:
 *   1. Google search: site:instagram.com "[business name]" "[city]"
 *   2. Extract Instagram profile URL from results
 *   3. Visit profile page (public, no login needed)
 *   4. Extract email from bio / page JSON
 *
 * Uses Playwright stealth to avoid detection.
 */

const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");

chromium.use(stealth());

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}/g;

// Junk emails to ignore
const JUNK_PATTERNS = [
  /noreply/i, /no-reply/i, /support@instagram/i, /help@/i,
  /privacy@/i, /legal@/i, /abuse@/i, /example\.com/i,
  /sentry\.io/i, /facebook\.com/i, /instagram\.com/i, /meta\.com/i,
];

function isUsefulEmail(email) {
  if (!email || email.length < 6) return false;
  return !JUNK_PATTERNS.some((p) => p.test(email));
}

/**
 * Search DuckDuckGo for a business's Instagram profile.
 * DuckDuckGo is much less aggressive with bot detection than Google.
 * @returns {string|null} Instagram profile URL
 */
async function findInstagramUrl(page, businessName, city) {
  // Clean business name for better search results
  const cleanName = businessName
    .replace(/,?\s*(LLC|Inc\.?|Ltd\.?|Corp\.?|P\/L)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const query = `site:instagram.com ${cleanName} ${city}`;
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000 + Math.random() * 2000);

  // Extract Instagram URLs from search results
  const html = await page.content();

  // DuckDuckGo puts URLs in the results — extract instagram.com links
  const igMatches = html.match(/https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/g) || [];

  const blocked = ["p", "reel", "reels", "explore", "accounts", "about", "legal", "developer", "stories", "tv", "tags"];

  for (const href of igMatches) {
    const match = href.match(/instagram\.com\/([a-zA-Z0-9_.]+)\/?$/);
    if (match && !blocked.includes(match[1].toLowerCase())) {
      return `https://www.instagram.com/${match[1]}/`;
    }
  }

  return null;
}

/**
 * Search DuckDuckGo for the business email directly.
 * Searches across all web sources (directories, social, listings).
 * @returns {string|null}
 */
async function findEmailDirect(page, businessName, city) {
  const cleanName = businessName
    .replace(/,?\s*(LLC|Inc\.?|Ltd\.?|Corp\.?|P\/L)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const query = `"${cleanName}" "${city}" email OR contact`;
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000 + Math.random() * 2000);

  const html = await page.content();
  const allEmails = html.match(EMAIL_RE) || [];
  const useful = [...new Set(allEmails.map((e) => e.toLowerCase()))].filter(isUsefulEmail);

  return useful.length > 0 ? useful[0] : null;
}

/**
 * Extract email from an Instagram profile page.
 * Instagram hides emails behind API now, so this has low hit rate.
 * Still tries: bio text, JSON data, mailto links.
 * @returns {string|null}
 */
async function extractEmailFromProfile(page, igUrl) {
  try {
    await page.goto(igUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000 + Math.random() * 1500);

    const loginWall = await page.locator('input[name="username"]').count();
    if (loginWall > 0) return null;

    const html = await page.content();

    const bioEmails = html.match(EMAIL_RE) || [];
    const useful = bioEmails.filter(isUsefulEmail);
    if (useful.length > 0) return useful[0].toLowerCase();

    const jsonMatches = html.match(/"email"\s*:\s*"([^"]+@[^"]+)"/gi) || [];
    for (const m of jsonMatches) {
      const emailMatch = m.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6})/);
      if (emailMatch && isUsefulEmail(emailMatch[1])) {
        return emailMatch[1].toLowerCase();
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Process a batch of leads — find Instagram → extract email.
 * @param {Array} leads - Leads without websites
 * @param {object} supabase - Supabase client
 * @param {object} opts - { concurrency, delayMs }
 */
async function enrichFromInstagram(leads, supabase, opts = {}) {
  const { concurrency = 1, delayMs = 5000 } = opts;

  console.log(`\n📸 Instagram enrichment — ${leads.length} leads`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });

  let found = 0;
  let searched = 0;
  let captchaHit = false;

  for (const lead of leads) {
    if (captchaHit) {
      console.log("    🛑 CAPTCHA hit — stopping to avoid ban");
      break;
    }

    searched++;
    const page = await context.newPage();

    try {
      // Step 1: Find Instagram URL via Google
      const igUrl = await findInstagramUrl(page, lead.name, lead.city);

      if (!igUrl) {
        console.log(`    ⏭️  ${lead.name} — no Instagram found`);
        await page.close();
        await delay(delayMs);
        continue;
      }

      console.log(`    🔍 ${lead.name} → ${igUrl}`);

      // Step 2: Try to extract email from Instagram profile
      let email = await extractEmailFromProfile(page, igUrl);
      let emailSource = "instagram";

      // Step 3: If no email on Instagram, search the web directly
      if (!email) {
        await page.waitForTimeout(2000 + Math.random() * 1500);
        email = await findEmailDirect(page, lead.name, lead.city);
        emailSource = "web_search";
      }

      // Save Instagram URL regardless
      const updates = { instagram: igUrl };

      if (email) {
        found++;
        updates.email = email;
        updates.email_source = emailSource;
        console.log(`    ✅ ${lead.name} → ${email} (via ${emailSource})`);
      } else {
        console.log(`    📷 ${lead.name} — Instagram found, no email anywhere`);
      }

      await supabase.from("leads").update(updates).eq("id", lead.id);
    } catch (err) {
      if (err.message?.includes("captcha") || err.message?.includes("429")) {
        captchaHit = true;
        console.log(`    ⚠️  Rate limited — stopping`);
      } else {
        console.log(`    ❌ ${lead.name}: ${err.message}`);
      }
    }

    await page.close();

    // Human-like delay between searches
    const jitter = delayMs + Math.random() * 3000;
    await delay(jitter);

    // Progress log every 10
    if (searched % 10 === 0) {
      console.log(`    📊 Progress: ${searched}/${leads.length} searched, ${found} emails found`);
    }
  }

  await browser.close();

  console.log(`\n📊 Instagram enrichment done: ${found} emails found out of ${searched} searched`);
  return { found, searched };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { enrichFromInstagram };
