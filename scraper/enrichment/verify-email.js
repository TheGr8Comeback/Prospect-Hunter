const dns = require("dns");
const net = require("net");

// ── DNS: resolve MX records ────────────────────────────────
function resolveMx(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) return reject(err);
      addresses.sort((a, b) => a.priority - b.priority);
      resolve(addresses);
    });
  });
}

// ── SMTP conversation ──────────────────────────────────────
// Connects to MX server and checks if RCPT TO is accepted
// WITHOUT sending any email.
function smtpCheck(mxHost, email, timeout = 4000, port = 25) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let step = 0;
    let buffer = "";
    let done = false;

    function finish(result) {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(timeout);
    socket.on("timeout", () => finish("timeout"));
    socket.on("error", () => finish("error"));

    socket.on("data", (data) => {
      buffer += data.toString();

      const lines = buffer.split("\r\n");
      const lastComplete = lines.slice(0, -1);
      if (lastComplete.length === 0) return;

      const finalLine = lastComplete[lastComplete.length - 1];
      if (finalLine.length >= 4 && finalLine[3] === "-") return;

      const code = parseInt(finalLine.substring(0, 3), 10);
      buffer = "";

      switch (step) {
        case 0:
          if (code === 220) {
            step = 1;
            socket.write("EHLO prospect-os.local\r\n");
          } else {
            finish("error");
          }
          break;

        case 1:
          if (code === 250) {
            step = 2;
            socket.write("MAIL FROM:<verify@prospect-os.local>\r\n");
          } else {
            finish("error");
          }
          break;

        case 2:
          if (code === 250) {
            step = 3;
            socket.write(`RCPT TO:<${email}>\r\n`);
          } else {
            finish("error");
          }
          break;

        case 3:
          socket.write("QUIT\r\n");
          if (code === 250) {
            finish("valid");
          } else if (code >= 550 && code <= 553) {
            finish("invalid");
          } else if (code >= 450 && code <= 452) {
            finish("greylisted");
          } else {
            finish("unknown");
          }
          break;

        default:
          finish("unknown");
      }
    });

    socket.connect(port, mxHost);
  });
}

// ── Try SMTP across multiple MX hosts ──────────────────────
// If first MX times out, try the next one
async function smtpCheckMultiMx(mxRecords, email, timeout = 4000) {
  const hostsToTry = mxRecords.slice(0, 3); // max 3 MX hosts
  for (const mx of hostsToTry) {
    const result = await smtpCheck(mx.exchange, email, timeout, 25);
    if (result === "valid" || result === "invalid") return { result, host: mx.exchange };
    if (result === "greylisted") return { result: "greylisted", host: mx.exchange };
    // timeout/error → try next MX
  }
  return { result: "timeout", host: hostsToTry[0]?.exchange };
}

// ── Catch-all detection ────────────────────────────────────
// Send RCPT TO with a random impossible email. If server accepts → catch-all.
async function checkCatchAll(mxHost, domain, timeout = 4000) {
  const random = `xyzcheck${Date.now()}${Math.random().toString(36).slice(2, 8)}@${domain}`;
  const result = await smtpCheck(mxHost, random, timeout, 25);
  return result === "valid"; // if random email is "valid" → catch-all server
}

// ── Known providers that block SMTP verification ───────────
const UNVERIFIABLE_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.fr", "yahoo.co.uk",
  "outlook.com", "hotmail.com", "hotmail.fr", "live.com", "msn.com",
  "aol.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me",
  "zoho.com",
]);

// ── Disposable email domain detection ──────────────────────
const DISPOSABLE_PATTERNS = [
  "tempmail", "throwaway", "guerrillamail", "mailinator", "yopmail",
  "trashmail", "fakeinbox", "sharklasers", "grr.la", "guerrillamailblock",
  "10minutemail", "temp-mail", "dispostable", "maildrop",
];

function isDisposableDomain(domain) {
  const lower = domain.toLowerCase();
  return DISPOSABLE_PATTERNS.some((p) => lower.includes(p));
}

// ── Main: verify a single email ────────────────────────────
// Status levels:
//   valid       → SMTP confirmed, safe to send
//   catch_all   → server accepts everything, may bounce later
//   mx_valid    → MX exists but SMTP blocked, can't confirm
//   unknown     → unverifiable provider or no info
//   invalid     → domain or mailbox doesn't exist
async function verifyEmail(email) {
  if (!email) return { status: "unknown", detail: "no_email" };

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return { status: "invalid", detail: "bad_format" };

  // Reject disposable email domains
  if (isDisposableDomain(domain)) {
    return { status: "invalid", detail: "disposable_domain" };
  }

  // Skip known unverifiable providers (Gmail, Yahoo, etc.)
  if (UNVERIFIABLE_DOMAINS.has(domain)) {
    return { status: "unknown", detail: "major_provider" };
  }

  // Step 1: DNS MX lookup
  let mxRecords;
  try {
    mxRecords = await resolveMx(domain);
  } catch {
    // No MX → try A record fallback
    try {
      await new Promise((resolve, reject) => {
        dns.resolve4(domain, (err, addresses) => {
          if (err || !addresses?.length) return reject(err);
          resolve(addresses);
        });
      });
      return { status: "unknown", detail: "no_mx_record" };
    } catch {
      return { status: "invalid", detail: "domain_not_found" };
    }
  }

  if (!mxRecords || mxRecords.length === 0) {
    return { status: "invalid", detail: "no_mx_record" };
  }

  // Step 2: SMTP check across MX hosts
  const { result, host } = await smtpCheckMultiMx(mxRecords, email, 4000);

  // Step 2b: Retry on greylist (wait 30s, try again)
  if (result === "greylisted" && host) {
    await new Promise((r) => setTimeout(r, 30000));
    const retry = await smtpCheck(host, email, 4000, 25);
    if (retry === "valid") return { status: "valid", detail: "smtp_confirmed_after_greylist" };
    if (retry === "invalid") return { status: "invalid", detail: "smtp_rejected" };
    return { status: "mx_valid", detail: "greylisted" };
  }

  if (result === "invalid") return { status: "invalid", detail: "smtp_rejected" };

  if (result === "valid") {
    // Step 3: Catch-all detection — does the server accept ANY email?
    const isCatchAll = await checkCatchAll(host, domain, 4000);
    if (isCatchAll) {
      return { status: "catch_all", detail: "server_accepts_all" };
    }
    return { status: "valid", detail: "smtp_confirmed" };
  }

  // Timeout/error — MX exists but can't verify
  return { status: "mx_valid", detail: "smtp_blocked_mx_ok" };
}

// ── Batch verify with delay between checks ─────────────────
async function verifyEmails(emails, delayMs = 1500) {
  const results = {};
  for (const email of emails) {
    if (!email) continue;
    results[email] = await verifyEmail(email);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

module.exports = { verifyEmail, verifyEmails };
