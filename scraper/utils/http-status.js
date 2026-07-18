// Distinguish "the site is genuinely dead/broken" from "the site refused our bot".
//
// 401 / 403 / 429 = access denied / rate limited = anti-bot protection (WAF,
// Cloudflare, franchise gateways). The site is alive for a human — it just
// blocked OUR request. Treating these as "website dead" fabricates a fake
// structural gap and inflates the lead tier. They are INCONCLUSIVE, never a gap.
//
// Only 404 / 410 (resource gone) and 5xx (server broken) mean the site is
// actually dead for everyone.

function isDeadStatus(code) {
  if (!code) return false;
  return code === 404 || code === 410 || (code >= 500 && code <= 599);
}

// Statuses that smell like bot-blocking — worth one retry with a real browser UA.
function isBotBlockStatus(code) {
  return code === 401 || code === 403 || code === 429;
}

module.exports = { isDeadStatus, isBotBlockStatus };
