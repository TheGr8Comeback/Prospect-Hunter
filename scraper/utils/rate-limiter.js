// ── Rate limiter par domaine ───────────────────────────────
// Garantit un délai minimum entre deux requêtes vers le même domaine.
// Usage :
//   const limiter = require('./utils/rate-limiter');
//   await limiter.wait("bbb.org");   // bloque si trop tôt
//   await fetch("https://www.bbb.org/...");

// Délais par défaut par domaine (en ms)
const DOMAIN_DELAYS = {
  "bbb.org":          1500,
  "www.bbb.org":      1500,
  "yelp.com":         2000,
  "www.yelp.com":     2000,
  "google.com":       1500,
  "www.google.com":   1500,
  "facebook.com":     1500,
  "www.facebook.com": 1500,
  "m.facebook.com":   1500,
  "linkedin.com":     2000,
  "www.linkedin.com": 2000,
  "html.duckduckgo.com": 1500,
};

const DEFAULT_DELAY = 100; // 100ms par défaut pour les domaines inconnus

// Timestamp du dernier appel par domaine
const lastCall = new Map();

// Extraire le domaine d'une URL
function extractDomain(urlOrDomain) {
  try {
    if (urlOrDomain.includes("://")) {
      return new URL(urlOrDomain).hostname;
    }
    return urlOrDomain;
  } catch {
    return urlOrDomain;
  }
}

// Attendre si nécessaire avant de faire une requête vers ce domaine
async function wait(urlOrDomain) {
  const domain = extractDomain(urlOrDomain);
  const delay = DOMAIN_DELAYS[domain] || DEFAULT_DELAY;
  const last = lastCall.get(domain) || 0;
  const elapsed = Date.now() - last;

  if (elapsed < delay) {
    const waitTime = delay - elapsed;
    await new Promise((r) => setTimeout(r, waitTime));
  }

  lastCall.set(domain, Date.now());
}

// Réinitialiser (utile pour les tests)
function reset() {
  lastCall.clear();
}

// Stats (pour le monitoring)
function getStats() {
  const stats = {};
  for (const [domain, timestamp] of lastCall) {
    stats[domain] = {
      lastCall: new Date(timestamp).toISOString(),
      delay: DOMAIN_DELAYS[domain] || DEFAULT_DELAY,
    };
  }
  return stats;
}

module.exports = { wait, reset, getStats, extractDomain };
