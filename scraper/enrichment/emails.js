const { isRealEmail } = require("../utils/email");

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}/g;

function extractEmails(html) {
  const raw = html.match(EMAIL_RE) || [];
  const unique = [...new Set(raw.map(e => e.toLowerCase()))];
  return unique.filter(isRealEmail);
}

module.exports = { extractEmails };
