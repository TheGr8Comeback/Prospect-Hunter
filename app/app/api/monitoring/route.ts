import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/monitoring — worker health + job stats + error history
export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalJobs },
      { count: pendingJobs },
      { count: runningJobs },
      { count: doneJobs },
      { count: failedJobs },
      { data: recentJobs },
      { data: failedRecent },
      { count: leadsToday },
      { count: enrichedToday },
      { count: totalLeads },
      { count: pendingEnrich },
      { data: lastDoneJob },
    ] = await Promise.all([
      // Job counts by status
      supabaseAdmin().from("jobs").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID),
      supabaseAdmin().from("jobs").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).eq("status", "pending"),
      supabaseAdmin().from("jobs").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).eq("status", "running"),
      supabaseAdmin().from("jobs").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).eq("status", "done"),
      supabaseAdmin().from("jobs").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).eq("status", "failed"),
      // Recent jobs (all statuses, last 20)
      supabaseAdmin().from("jobs").select("id, type, status, params, progress, error, last_error, retry_count, max_retries, created_at, started_at, finished_at").eq("workspace_id", WORKSPACE_ID).order("created_at", { ascending: false }).limit(20),
      // Failed jobs (last 10 with errors)
      supabaseAdmin().from("jobs").select("id, type, error, last_error, retry_count, params, created_at, finished_at").eq("workspace_id", WORKSPACE_ID).eq("status", "failed").order("finished_at", { ascending: false }).limit(10),
      // Leads scraped today
      supabaseAdmin().from("leads").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).gte("created_at", today),
      // Leads enriched today
      supabaseAdmin().from("leads").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).gte("enriched_at", today),
      // Total leads
      supabaseAdmin().from("leads").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID),
      // Pending enrichment
      supabaseAdmin().from("leads").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).eq("enrichment_status", "pending"),
      // Last completed job (for worker heartbeat)
      supabaseAdmin().from("jobs").select("finished_at").eq("workspace_id", WORKSPACE_ID).eq("status", "done").order("finished_at", { ascending: false }).limit(1),
    ]);

    // Worker health: check if any job completed recently
    const lastActivity = lastDoneJob?.[0]?.finished_at;
    const workerActive = lastActivity && new Date(lastActivity).getTime() > new Date(oneHourAgo).getTime();

    // Calculate job durations for recent jobs
    const jobsWithDuration = (recentJobs ?? []).map((j) => {
      let durationSec = null;
      if (j.started_at && j.finished_at) {
        durationSec = Math.round((new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000);
      }
      return { ...j, duration_sec: durationSec };
    });

    return NextResponse.json({
      worker: {
        status: runningJobs && runningJobs > 0 ? "running" : workerActive ? "idle" : "inactive",
        last_activity: lastActivity || null,
      },
      jobs: {
        total: totalJobs ?? 0,
        pending: pendingJobs ?? 0,
        running: runningJobs ?? 0,
        done: doneJobs ?? 0,
        failed: failedJobs ?? 0,
      },
      leads: {
        total: totalLeads ?? 0,
        scraped_today: leadsToday ?? 0,
        enriched_today: enrichedToday ?? 0,
        pending_enrichment: pendingEnrich ?? 0,
      },
      recent_jobs: jobsWithDuration,
      recent_errors: failedRecent ?? [],
      timestamp: now.toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
