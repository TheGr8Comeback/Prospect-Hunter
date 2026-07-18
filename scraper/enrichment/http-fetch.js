const https = require("https");
const http = require("http");
const { URL } = require("url");
const rateLimiter = require("../utils/rate-limiter");

// ── Shared browser-UA fetch helper ─────────────────────────
// Used by the Facebook website-recovery module. Kept generic so it has no tie
// to any people-scraping code.
async function fetchPage(url, timeout = 10_000) {
  await rateLimiter.wait(url);

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.request(parsed, {
      timeout,
      family: 4, // force IPv4 — see website.js: broken IPv6 routes fast-fail otherwise
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        fetchPage(new URL(res.headers.location, url).href, timeout)
          .then(resolve).catch(reject);
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

module.exports = { fetchPage };
