require("dotenv").config({ path: "../app/.env.local" });

const { createClient } = require("@supabase/supabase-js");
const osm = require("./sources/osm");
const gmaps = require("./sources/gmaps");
const yelp = require("./sources/yelp");
const yellowpages = require("./sources/yellowpages");
const bbb = require("./sources/bbb");
const { enrichWebsite } = require("./enrichment/website");
const { extractSocials } = require("./enrichment/socials");
const { extractEmails } = require("./enrichment/emails");
const { computeScore } = require("./scoring/score");
const { computeWarmScore } = require("./scoring/warm-score");
const { buildHooks } = require("./enrichment/hooks");
const { enrichPageSpeed, isWorthChecking } = require("./enrichment/pagespeed");
const { checkDisqualified } = require("./enrichment/disqualify");
const { detectWebsiteType } = require("./enrichment/website-type");
const { classifyLead } = require("./scoring/lead-tier");
const { runEnrichment } = require("./enrichment/registry");
const { screenshotAndUpload } = require("./enrichment/screenshot");
const { verifyEmail } = require("./enrichment/verify-email");
const { classifyEmail } = require("./utils/email");
const WebSocket = require("ws");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Variables manquantes dans .env.local");
  console.error("    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});

// ── Enrich a single lead ────────────────────────────────────
// Enrichment is now a selectable pipeline — see enrichment/registry.js.
// enrichOpts comes from the job: { preset } | { modules: [...] } | undefined
// (undefined → the `default` preset, i.e. the full legacy pipeline).
async function enrichLead(lead, enrichOpts) {
  return runEnrichment(lead, enrichOpts);
}

// ── Job: enrich ─────────────────────────────────────────────
async function handleEnrich(job) {
  const concurrency = Math.max(1, Math.min(job.params.concurrency ?? 1, 20));
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", job.workspace_id)
    .eq("enrichment_status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);
  if (!leads || leads.length === 0) {
    console.log("  ℹ️  Aucun lead à enrichir");
    return;
  }

  // Mark leads without website AND without phone as "skipped" — nothing to enrich
  const enrichable = [];
  let skippedCount = 0;
  for (const lead of leads) {
    if (!lead.website && !lead.phone && !lead.email) {
      await supabase.from("leads").update({ enrichment_status: "skipped" }).eq("id", lead.id);
      skippedCount++;
    } else {
      enrichable.push(lead);
    }
  }
  if (skippedCount > 0) {
    console.log(`  ⏭️  ${skippedCount} leads sans données → skipped`);
  }

  console.log(`  📦 ${enrichable.length} leads à enrichir (×${concurrency} en parallele)`);

  let enriched = 0;

  // Process leads in parallel batches — update progress per lead
  for (let i = 0; i < enrichable.length; i += concurrency) {
    const batch = enrichable.slice(i, i + concurrency);

    await Promise.allSettled(
      batch.map(async (lead) => {
        try {
          const updates = await enrichLead(lead, job.params.enrich);
          const { error: upErr } = await supabase
            .from("leads")
            .update(updates)
            .eq("id", lead.id);

          if (upErr) {
            console.error(`    ⚠️  ${lead.name} : ${upErr.message}`);
          } else {
            enriched++;
            console.log(`    ✅  ${lead.name.padEnd(40)} → score ${updates.score}/100`);
          }
        } catch (err) {
          console.error(`    ❌  ${lead.name} : ${err.message}`);
          await supabase.from("leads").update({
            enrichment_status: "failed",
          }).eq("id", lead.id);
        }

        // Update progress after each lead
        await supabase.from("jobs").update({
          progress: { enriched, total: enrichable.length, skipped: skippedCount },
        }).eq("id", job.id);
      })
    );
  }

  console.log(`\n  📊 Enrichissement terminé : ${enriched}/${enrichable.length} (${skippedCount} skipped)`);
}

// ── Job: re-enrich (partial, only missing parts) ────────────
async function handleReEnrich(job) {
  const target = job.params.target ?? "failed"; // "failed" | "no_email"
  const concurrency = Math.max(1, Math.min(job.params.concurrency ?? 1, 20));

  let query = supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", job.workspace_id);

  if (target === "failed") {
    query = query.eq("enrichment_status", "failed");
  } else if (target === "no_email") {
    query = query.is("email", null).eq("enrichment_status", "ok");
  }

  const { data: leads, error } = await query.order("created_at", { ascending: true }).limit(100);

  if (error) throw new Error(error.message);
  if (!leads || leads.length === 0) {
    console.log(`  ℹ️  Aucun lead a re-enrichir (cible: ${target})`);
    return;
  }

  console.log(`  🔄 ${leads.length} leads a re-enrichir [${target}] (×${concurrency})`);

  let done = 0;

  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);

    await Promise.allSettled(
      batch.map(async (lead) => {
        try {
          const updates = {};

          // Re-run only what's missing
          if (target === "failed" || !lead.website_score) {
            const ws = await enrichWebsite(lead);
            if (ws) {
              const { _html, ...signals } = ws;
              Object.assign(updates, signals);

              if (!lead.email && _html) {
                const emails = extractEmails(_html);
                if (emails.length > 0) updates.email = emails[0];
              }
              if (_html) {
                const socials = extractSocials(_html);
                if (Object.keys(socials).length > 0) Object.assign(updates, socials);
              }
            }
          }

          if (target === "failed" || target === "no_email") {
            const emailToVerify = updates.email || lead.email;
            if (emailToVerify && !lead.email_status) {
              const result = await verifyEmail(emailToVerify);
              updates.email_status = result.status;
            }
          }

          if (Object.keys(updates).length > 0) {
            const merged = { ...lead, ...updates };
            const { score, score_detail } = computeScore(merged);
            updates.score = score;
            updates.score_detail = score_detail;

            const { warm_score, warm_detail } = computeWarmScore(merged);
            updates.warm_score = warm_score;
            updates.warm_detail = warm_detail;

            updates.hooks = buildHooks({ ...merged, ...updates }).hooks;

            updates.enrichment_status = "ok";
            updates.enriched_at = new Date().toISOString();

            await supabase.from("leads").update(updates).eq("id", lead.id);
            done++;
            console.log(`    ✅  ${lead.name.padEnd(40)} → score ${score}/100`);
          }
        } catch (err) {
          console.error(`    ❌  ${lead.name} : ${err.message}`);
        }

        // Update progress after each lead
        await supabase.from("jobs").update({
          progress: { enriched: done, total: leads.length },
        }).eq("id", job.id);
      })
    );
  }

  console.log(`\n  📊 Re-enrichissement terminé : ${done}/${leads.length}`);
}

// ── Dispatcher ───────────────────────────────────────────────
async function handleJob(job) {
  console.log(`\n🔧  Job [${job.type}] démarré — ${job.id}`);
  console.log(`    Params : ${JSON.stringify(job.params)}`);

  await supabase.from("jobs").update({
    status: "running",
    started_at: new Date().toISOString(),
  }).eq("id", job.id);

  try {
    switch (job.type) {
      case "scrape": {
        // Count leads before scrape to know how many were added
        const { count: beforeCount } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", job.workspace_id);

        const sources = job.params.sources ?? ["osm"];
        // Sum candidates scanned across ALL sources. Each source returns
        // { inserted, total } — without this the job's `found` counter just
        // showed the LAST source's number (each overwrote the previous),
        // reading e.g. "1 found" even when other sources had added leads.
        let scannedTotal = 0;
        for (const src of sources) {
          let ret;
          if (src === "osm") ret = await osm.run(job, supabase);
          else if (src === "gmaps") ret = await gmaps.run(job, supabase);
          else if (src === "yelp") ret = await yelp.run(job, supabase);
          else if (src === "yellowpages") ret = await yellowpages.run(job, supabase);
          else if (src === "bbb") ret = await bbb.run(job, supabase);
          else { console.warn(`  ⚠️  Source inconnue : ${src}`); continue; }
          scannedTotal += ret?.total ?? 0;
        }

        const { count: afterCount } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", job.workspace_id);

        // Authoritative final progress: real net-new leads added to the DB
        // (dedup-safe — cross-source duplicates count once), scanned total.
        job._scrapedCount = (afterCount || 0) - (beforeCount || 0);
        await supabase.from("jobs").update({
          progress: { found: job._scrapedCount, total: scannedTotal },
        }).eq("id", job.id);
        break;
      }
      case "enrich":
        await handleEnrich(job);
        break;
      case "screenshot": {
        const { slug } = job.params;
        const { data: lead } = await supabase.from("leads").select("*").eq("workspace_id", job.workspace_id).eq("slug", slug).single();
        if (!lead) throw new Error(`Lead introuvable : ${slug}`);
        const url = await screenshotAndUpload(lead, supabase);
        console.log(`  📸 Screenshot → ${url}`);
        break;
      }
      case "re-enrich":
        await handleReEnrich(job);
        break;
      default:
        throw new Error(`Type inconnu : ${job.type}`);
    }

    await supabase.from("jobs").update({
      status: "done",
      finished_at: new Date().toISOString(),
    }).eq("id", job.id);

    console.log(`✅  Job [${job.type}] terminé — ${job.id}`);
  } catch (err) {
    console.error(`❌  Job [${job.type}] échoué :`, err.message);

    const retryCount = (job.retry_count || 0) + 1;
    const maxRetries = job.max_retries ?? 3;

    if (retryCount < maxRetries) {
      // Exponential backoff: 30s, 120s, 480s (×4 each time)
      const delaySec = 30 * Math.pow(4, retryCount - 1);
      const nextRetryAt = new Date(Date.now() + delaySec * 1000).toISOString();
      console.log(`🔄  Retry ${retryCount}/${maxRetries} programmé dans ${delaySec}s`);

      await supabase.from("jobs").update({
        status: "pending",
        retry_count: retryCount,
        last_error: err.message,
        next_retry_at: nextRetryAt,
        finished_at: null,
      }).eq("id", job.id);
    } else {
      await supabase.from("jobs").update({
        status: "failed",
        error: err.message,
        last_error: err.message,
        retry_count: retryCount,
        finished_at: new Date().toISOString(),
      }).eq("id", job.id);
    }
  }
}

// ── Auto-enrich after scrape ────────────────────────────────
async function autoEnrichPending(job, scrapedCount = 0) {
  if (scrapedCount === 0) {
    console.log(`\n⏭️  Scrape a trouvé 0 résultats — skip auto-enrichissement`);
    return;
  }

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", job.workspace_id)
    .eq("enrichment_status", "pending");

  if (count > 0) {
    console.log(`\n🔄  ${count} leads pending → auto-enrichissement`);

    const { data } = await supabase
      .from("jobs")
      .insert({
        workspace_id: job.workspace_id,
        type: "enrich",
        params: { concurrency: job.params.concurrency ?? 5, enrich: job.params.enrich },
        status: "pending",
      })
      .select()
      .single();

    if (data) await handleJob(data);
  }
}

// ── Concurrency control ─────────────────────────────────────
const MAX_CONCURRENT_JOBS = 3; // max jobs running at the same time
const activeJobs = new Set(); // job IDs currently running

async function runJob(job) {
  try {
    await handleJob(job);
    if (job.type === "scrape") {
      await autoEnrichPending(job, job._scrapedCount || 0);
    }
  } finally {
    activeJobs.delete(job.id);
    console.log(`    [slots ${activeJobs.size}/${MAX_CONCURRENT_JOBS}]`);
  }
}

// ── Poll loop ────────────────────────────────────────────────
async function poll() {
  // Don't pick up new jobs if all slots are full
  const available = MAX_CONCURRENT_JOBS - activeJobs.size;
  if (available <= 0) return;

  const now = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(available);

  if (error) {
    console.error("⚠️   Erreur poll :", error.message);
    return;
  }

  if (!jobs || jobs.length === 0) return;

  for (const job of jobs) {
    // Skip if already running locally (race condition guard)
    if (activeJobs.has(job.id)) continue;

    activeJobs.add(job.id);

    if (job.retry_count > 0) {
      console.log(`🔄  Retry ${job.retry_count}/${job.max_retries} pour [${job.type}] — ${job.id}`);
    }

    // Fire and forget — don't await, let it run in parallel
    runJob(job).catch((err) => {
      console.error(`💥  runJob crashed for [${job.type}] — ${job.id}:`, err.message);
    });
  }
}

// ── Realtime subscription ───────────────────────────────────
function startRealtime() {
  const channel = supabase
    .channel("worker-jobs")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "jobs",
      },
      (payload) => {
        console.log(`⚡  Nouveau job detecte via Realtime → [${payload.new.type}]`);
        poll();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "jobs",
      },
      (payload) => {
        // Un job retry repasse en pending → le reprendre
        if (payload.new.status === "pending" && payload.old?.status !== "pending") {
          console.log(`⚡  Job repassé en pending via Realtime → [${payload.new.type}]`);
          poll();
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("📡  Realtime connecte — ecoute les nouveaux jobs");
      } else if (status === "CHANNEL_ERROR") {
        console.error("⚠️  Realtime erreur — fallback poll actif");
      } else if (status === "TIMED_OUT") {
        console.error("⚠️  Realtime timeout — fallback poll actif");
      }
    });

  return channel;
}

// ── Heartbeat ───────────────────────────────────────────────
async function sendHeartbeat() {
  try {
    const { data: workspaces } = await supabase.from("workspaces").select("id");
    if (!workspaces || workspaces.length === 0) return;

    const now = new Date().toISOString();
    const rows = workspaces.map((w) => ({
      workspace_id: w.id,
      worker_name: "main",
      last_ping: now,
    }));

    await supabase.from("worker_heartbeats").upsert(rows, { onConflict: "workspace_id,worker_name" });
  } catch (err) {
    console.error("⚠️  Heartbeat failed:", err.message);
  }
}

// ── Global error handlers ───────────────────────────────────
process.on("unhandledRejection", (err) => {
  console.error("⚠️  Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("💀  Uncaught exception:", err);
  // Give time to flush logs, then exit (PM2 will restart)
  setTimeout(() => process.exit(1), 1000);
});

// ── Cleanup stale "running" jobs on startup ─────────────────
async function cleanupStaleJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "pending", last_error: "worker restarted" })
    .eq("status", "running")
    .select("id, type");

  if (error) {
    console.error("⚠️  Cleanup failed:", error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log(`🧹  ${data.length} job(s) bloqués en "running" → repris`);
    data.forEach((j) => console.log(`    ↻ [${j.type}] ${j.id}`));
  }
}

// ── Self-host: ensure the default workspace exists ──────────
// In self-host mode there's no signup flow to create a workspace, so we seed
// one here (service-role, so it works even without SUPABASE_DB_URL). Idempotent.
async function ensureDefaultWorkspace() {
  if (process.env.AUTH_ENABLED === "true") return; // multi-tenant: skip
  const id = process.env.DEFAULT_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001";
  const { error } = await supabase
    .from("workspaces")
    .upsert({ id, name: "Mon espace" }, { onConflict: "id" });
  if (error) console.error("⚠️  Seed workspace échoué:", error.message);
  else console.log(`🏠  Workspace self-host prêt (${id})`);
}

// ── Start ────────────────────────────────────────────────────
console.log("🚀  Prospect OS Worker démarré");
console.log(`    Max jobs simultanes : ${MAX_CONCURRENT_JOBS}`);
console.log(`    Mode : Realtime + fallback poll 60s\n`);

ensureDefaultWorkspace()
  .catch((err) => console.error("⚠️  ensureDefaultWorkspace error:", err.message))
  .finally(() => cleanupStaleJobs().catch((err) => {
    console.error("⚠️  Cleanup error:", err.message);
  }).finally(() => {
    startRealtime();
    setInterval(poll, 60_000); // fallback poll every 60s
    poll(); // check for any pending jobs on startup
  }));

sendHeartbeat(); // initial heartbeat
setInterval(sendHeartbeat, 5 * 60_000); // heartbeat every 5 min

