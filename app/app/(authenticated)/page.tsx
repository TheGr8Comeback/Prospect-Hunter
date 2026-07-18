import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { workspaceId: WORKSPACE_ID } = await getSession();
  const [
    { count: totalLeads },
    { count: withEmail },
    { count: pendingJobs },
    { data: recentLeads },
    { data: allLeads },
  ] = await Promise.all([
    supabaseAdmin().from("leads").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID),
    supabaseAdmin().from("leads").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).not("email", "is", null),
    supabaseAdmin().from("jobs").select("*", { count: "exact", head: true }).eq("workspace_id", WORKSPACE_ID).in("status", ["pending", "running"]),
    supabaseAdmin().from("leads").select("name, slug, warm_score, city, category, created_at").eq("workspace_id", WORKSPACE_ID).order("created_at", { ascending: false }).limit(6),
    supabaseAdmin().from("leads").select("sources, city, warm_score").eq("workspace_id", WORKSPACE_ID),
  ]);

  const total = totalLeads ?? 0;
  const rows = allLeads ?? [];

  // Warm score distribution
  const warmScores = rows.map((l: { warm_score: number | null }) => l.warm_score ?? 0);
  const warmHigh = warmScores.filter((s: number) => s >= 70).length;
  const warmMid = warmScores.filter((s: number) => s >= 40 && s < 70).length;
  const warmLow = warmScores.filter((s: number) => s < 40).length;

  // Sources
  const sourceCounts: Record<string, number> = {};
  rows.forEach((l: { sources: string[] | null }) => (l.sources ?? []).forEach((s: string) => { sourceCounts[s] = (sourceCounts[s] ?? 0) + 1; }));

  // Top cities
  const cityCounts: Record<string, number> = {};
  rows.forEach((l: { city: string | null }) => { if (l.city) cityCounts[l.city] = (cityCounts[l.city] ?? 0) + 1; });
  const topCities = Object.entries(cityCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div className="p-10 max-w-5xl">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-white/40 mt-1">Your lead intelligence overview</p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total leads", value: total, color: "text-white" },
          { label: "Warm ≥ 70", value: warmHigh, color: "text-emerald-400" },
          { label: "With email", value: withEmail ?? 0, color: "text-cyan-400" },
          { label: "Active jobs", value: pendingJobs ?? 0, color: "text-blue-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-white/[0.06] rounded-xl px-5 py-4">
            <p className={`text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
            <p className="text-[11px] font-mono text-white/30 mt-2 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        {/* Warm score distribution */}
        <section className="border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">Warm score distribution</h2>
          <div className="space-y-3">
            {[
              { label: "70-100", count: warmHigh, color: "bg-emerald-400" },
              { label: "40-69", count: warmMid, color: "bg-amber-400" },
              { label: "0-39", count: warmLow, color: "bg-white/20" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-xs font-mono text-white/40 w-16 shrink-0">{s.label}</span>
                <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.color}`} style={{ width: total > 0 ? `${(s.count / total) * 100}%` : "0%" }} />
                </div>
                <span className="text-xs font-mono text-white/40 w-10 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sources */}
        <section className="border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">By source</h2>
          <div className="space-y-2">
            {Object.entries(sourceCounts).sort(([, a], [, b]) => b - a).map(([src, count]) => (
              <div key={src} className="flex items-center justify-between">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/[0.04] text-white/40">{src}</span>
                <span className="text-xs font-mono text-white/30">{count}</span>
              </div>
            ))}
            {Object.keys(sourceCounts).length === 0 && <p className="text-xs text-white/20">No data</p>}
          </div>
        </section>

        {/* Top cities */}
        <section className="border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">Top cities</h2>
          <div className="space-y-2">
            {topCities.map(([city, count]) => (
              <div key={city} className="flex items-center justify-between">
                <span className="text-xs text-white/60">{city}</span>
                <span className="text-xs font-mono text-white/30">{count}</span>
              </div>
            ))}
            {topCities.length === 0 && <p className="text-xs text-white/20">No data</p>}
          </div>
        </section>

        {/* Recent leads */}
        <section className="border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">Recent leads</h2>
          <div className="space-y-2">
            {(recentLeads ?? []).map((l: { slug: string; name: string; warm_score: number | null }) => (
              <Link key={l.slug} href={`/leads/${l.slug}`} className="flex items-center justify-between hover:bg-white/[0.03] -mx-2 px-2 py-1 rounded transition-colors">
                <span className="text-xs text-white/60 truncate">{l.name}</span>
                <span className="text-[10px] font-mono text-white/40">{l.warm_score ?? "—"}</span>
              </Link>
            ))}
            {(recentLeads ?? []).length === 0 && <p className="text-xs text-white/20">No leads</p>}
          </div>
        </section>
      </div>

      {/* Quick actions */}
      <div className="border border-white/[0.06] rounded-xl px-5 py-4">
        <p className="text-[11px] font-mono tracking-widest uppercase text-white/25 mb-4">Quick actions</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/jobs/new" className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm transition-colors">New scrape</Link>
          <Link href="/leads" className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm transition-colors">View leads</Link>
          <Link href="/map" className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm transition-colors">Map</Link>
        </div>
      </div>
    </div>
  );
}
