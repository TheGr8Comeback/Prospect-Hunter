// Enrichment module registry.
//
// Each enrichment step is a self-contained MODULE. A job selects which modules
// to run (via a niche PRESET or an explicit list) — so scraping bakers never
// fires the browser-heavy `photos` module, and a resort run can add it.
//
// Modules fall in two groups:
//   • collectors — selectable, gather data into ctx.updates (some fetch, some cheap)
//   • derived    — always run last, computed from whatever was collected
//                  (score / warm_score / disqualify / hooks / lead_tier). Free,
//                  and safe with missing inputs (each has its own defaults).
//
// Shared context (ctx) carries the fetched HTML once, so socials/emails/etc.
// reuse it instead of re-fetching.

const { detectWebsiteType } = require("./website-type");
const { enrichWebsite } = require("./website");
const { extractSocials } = require("./socials");
const { extractEmails } = require("./emails");
const { classifyEmail } = require("../utils/email");
const { verifyEmail } = require("./verify-email");
const { enrichPageSpeed, isWorthChecking } = require("./pagespeed");
const { computeScore } = require("../scoring/score");
const { computeWarmScore } = require("../scoring/warm-score");
const { checkDisqualified } = require("./disqualify");
const { buildHooks } = require("./hooks");
const { classifyLead } = require("../scoring/lead-tier");
const { estimateBusinessSize } = require("../utils/email");
const { enrichFromFacebook } = require("./fb-website");
const { fetchPage: fetchFbPage } = require("./http-fetch");
const { enrichSeo } = require("./seo");
const { detectChatbot, chatbotOpportunity } = require("./chatbot");

// ── Collector modules ───────────────────────────────────────
// cost: cheap = no network · api = external call/quota · browser = Playwright
const MODULES = {
  website_type: {
    name: "website_type", cost: "cheap", deps: [],
    run(ctx) { Object.assign(ctx.updates, detectWebsiteType(ctx.lead.website)); },
  },

  website: {
    name: "website", cost: "api", deps: [],
    async run(ctx) {
      const ws = await enrichWebsite(ctx.lead);
      if (!ws) {
        // enrichWebsite returns null ONLY when the fetch itself failed (a lead
        // with no website URL never gets here with one). Flag it so the lead is
        // NOT finalized as "ok" with empty signals — otherwise a transient fetch
        // failure masquerades as a fully-enriched lead and silently lands in
        // SKIP (no seo/mobile/chat data → no service angle). See runEnrichment.
        if (ctx.lead.website) ctx.websiteFetchFailed = true;
        return;
      }
      const { _html, ...signals } = ws;
      ctx.html = _html;                 // null for parked/dead sites
      Object.assign(ctx.updates, signals);
    },
  },

  socials: {
    name: "socials", cost: "cheap", deps: ["website"],
    run(ctx) {
      if (!ctx.html) return;
      const socials = extractSocials(ctx.html);
      if (Object.keys(socials).length > 0) Object.assign(ctx.updates, socials);
    },
  },

  // On-page SEO audit → seo_score + detail. Free (reuses ctx.html).
  seo: {
    name: "seo", cost: "cheap", deps: ["website"],
    run(ctx) {
      // No readable page (siteless, parked, or bot-blocked) → clear any stale
      // score rather than leaving a value that was computed on an empty error
      // page. A leftover fake-low seo_score can fabricate a false STRONG.
      if (!ctx.html) { ctx.updates.seo_score = null; ctx.updates.seo_detail = null; return; }
      const res = enrichSeo(ctx.html);
      if (res) Object.assign(ctx.updates, res);
    },
  },

  // Existing chat widget + chatbot opportunity. Free (reuses ctx.html).
  chatbot: {
    name: "chatbot", cost: "cheap", deps: ["website"],
    run(ctx) {
      if (!ctx.html) {
        ctx.updates.has_chat = null;
        ctx.updates.chat_vendor = null;
        ctx.updates.chatbot_opportunity = null;
        return;
      }
      const c = detectChatbot(ctx.html);
      const merged = { ...ctx.lead, ...ctx.updates };
      c.chatbot_opportunity = chatbotOpportunity(c.has_chat, merged.review_pain);
      Object.assign(ctx.updates, c);
    },
  },

  emails: {
    name: "emails", cost: "cheap", deps: ["website"],
    run(ctx) {
      if (!ctx.html || ctx.lead.email) return;
      const emails = extractEmails(ctx.html);
      if (emails.length > 0) {
        ctx.updates.email = emails[0];
        ctx.updates.email_type = classifyEmail(emails[0]);
      }
    },
  },

  email_verify: {
    name: "email_verify", cost: "api", deps: [],
    gate: (merged) => !!(merged.email),
    async run(ctx) {
      const email = ctx.updates.email || ctx.lead.email;
      if (!email) return;
      try {
        const result = await verifyEmail(email);
        ctx.updates.email_status = result.status;
        const icon = result.status === "valid" ? "✓" : result.status === "invalid" ? "✗" : "~";
        console.log(`    ${icon}  Email: ${result.status} (${result.detail})`);
      } catch (err) {
        console.log(`    ⚠️  Email verification failed: ${err.message}`);
        ctx.updates.email_status = "unknown";
      }
    },
  },

  // Recover a real website from the lead's Facebook page. Fires only for
  // siteless leads that HAVE a facebook — turns a fabricated "no website" gap
  // into either a found site or a verified fb_checked=true.
  fb_website: {
    name: "fb_website", cost: "api", deps: ["website_type", "socials"],
    gate: (merged) => !!merged.facebook && (merged.no_real_website || !merged.website),
    async run(ctx) {
      const merged = { ...ctx.lead, ...ctx.updates };
      const updates = await enrichFromFacebook(merged, fetchFbPage);
      Object.assign(ctx.updates, updates);
    },
  },

  pagespeed: {
    name: "pagespeed", cost: "api", deps: ["website"],
    gate: (merged) => isWorthChecking(merged),
    async run(ctx) {
      const merged = { ...ctx.lead, ...ctx.updates };
      const ps = await enrichPageSpeed(merged.website);
      if (ps) Object.assign(ctx.updates, ps);
    },
  },

  // photos:  TODO — GMaps/FB image capture (cost: browser)
  // screenshot: TODO — screenshotAndUpload (cost: browser, needs ctx.supabase)
};

// Canonical run order — deps always precede dependents.
const CANON = ["website_type", "website", "socials", "seo", "chatbot", "fb_website", "emails", "email_verify", "pagespeed"];

// Niche presets. `default` runs the full pipeline including the FB site check.
const PRESETS = {
  default: ["website_type", "website", "socials", "seo", "chatbot", "fb_website", "emails", "email_verify", "pagespeed"],
  webgap:  ["website_type", "website", "socials", "seo", "chatbot", "fb_website", "emails", "email_verify"],
  resort:  ["website_type", "website", "socials", "emails", "email_verify"], // + photos (todo)
  baker:   ["website_type", "socials", "emails"], // socials pulls in `website` via deps
};

function resolveSelection(opts) {
  if (!opts) return PRESETS.default;
  if (Array.isArray(opts.modules) && opts.modules.length) return opts.modules;
  if (opts.preset && PRESETS[opts.preset]) return PRESETS[opts.preset];
  return PRESETS.default;
}

// Expand deps, then order by CANON.
function resolve(selected) {
  const want = new Set(selected.filter((n) => MODULES[n]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of Array.from(want)) {
      for (const d of MODULES[n].deps) {
        if (!want.has(d)) { want.add(d); changed = true; }
      }
    }
  }
  return CANON.filter((n) => want.has(n)).map((n) => MODULES[n]);
}

function runDerived(ctx) {
  const merged = { ...ctx.lead, ...ctx.updates };

  // business_size is DERIVED, not a scrape fact. Computing it in the source
  // freezes it at first sight (e.g. an OSM insert with 0 reviews → "small"),
  // even after a later merge fills reviews_count. Recompute it here from the
  // freshest merged data so it stays coherent with rating/reviews.
  ctx.updates.business_size = estimateBusinessSize(merged);

  const { score, score_detail } = computeScore(merged);
  ctx.updates.score = score;
  ctx.updates.score_detail = score_detail;

  const { warm_score, warm_detail } = computeWarmScore(merged);
  ctx.updates.warm_score = warm_score;
  ctx.updates.warm_detail = warm_detail;

  const dq = checkDisqualified(merged, ctx.html);
  ctx.updates.disqualified = dq.disqualified;
  ctx.updates.disqualified_reason = dq.disqualified_reason;

  ctx.updates.hooks = buildHooks({ ...merged, ...ctx.updates }).hooks;

  const { lead_tier, tier_reason } = classifyLead({ ...merged, ...ctx.updates });
  ctx.updates.lead_tier = lead_tier;
  ctx.updates.tier_reason = tier_reason;
}

// opts: undefined | { preset } | { modules: [...] } | { ...deps like supabase }
async function runEnrichment(lead, opts) {
  const ctx = { lead, updates: {}, html: null, deps: opts || {} };
  for (const mod of resolve(resolveSelection(opts))) {
    if (mod.gate && !mod.gate({ ...lead, ...ctx.updates }, ctx)) continue;
    // Isolate each collector: a single flaky module (a pagespeed timeout, a
    // verify-email quota error) must NOT abort the pipeline and leave a stale,
    // frozen verdict from a previous run. Log it and carry on — the derived
    // step always runs on best-effort data.
    try {
      await mod.run(ctx);
    } catch (err) {
      console.log(`    ⚠️  module ${mod.name} failed: ${err.message}`);
    }
  }
  runDerived(ctx);
  // A failed website fetch → "failed" (visible + retryable), not a fake "ok".
  // Everything else — including siteless leads and detected-parked sites, where
  // an empty ctx.html is the real answer — is genuinely enriched.
  ctx.updates.enrichment_status = ctx.websiteFetchFailed ? "failed" : "ok";
  ctx.updates.enriched_at = new Date().toISOString();
  return ctx.updates;
}

module.exports = { runEnrichment, resolve, resolveSelection, MODULES, PRESETS, CANON };
