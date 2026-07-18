const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");

chromium.use(stealth());

async function takeScreenshot(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);
    return await page.screenshot({ type: "jpeg", quality: 80, fullPage: false });
  } finally {
    await browser.close();
  }
}

async function screenshotAndUpload(lead, supabase) {
  if (!lead.website) return null;

  let url = lead.website;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const buffer = await takeScreenshot(url);
  const path = `${lead.workspace_id}/${lead.slug}.jpg`;

  const { error } = await supabase.storage
    .from("screenshots")
    .upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from("screenshots").getPublicUrl(path);

  await supabase
    .from("leads")
    .update({ screenshot_url: data.publicUrl })
    .eq("id", lead.id);

  return data.publicUrl;
}

module.exports = { screenshotAndUpload };
