"use client";

import { useEffect, useState, useCallback } from "react";

interface MonitoringData {
  worker: {
    status: "running" | "idle" | "inactive";
    last_activity: string | null;
  };
  jobs: {
    total: number;
    pending: number;
    running: number;
    done: number;
    failed: number;
  };
  leads: {
    total: number;
    scraped_today: number;
    enriched_today: number;
    pending_enrichment: number;
  };
  recent_jobs: Array<{
    id: string;
    type: string;
    status: string;
    params: Record<string, unknown>;
    progress: Record<string, number> | null;
    error: string | null;
    last_error: string | null;
    retry_count: number;
    max_retries: number;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    duration_sec: number | null;
  }>;
  recent_errors: Array<{
    id: string;
    type: string;
    error: string | null;
    last_error: string | null;
    retry_count: number;
    params: Record<string, unknown>;
    created_at: string;
    finished_at: string | null;
  }>;
  timestamp: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400",
  running: "text-blue-400",
  done: "text-emerald-400",
  failed: "text-red-400",
};

const STATUS_BG: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400",
  running: "bg-blue-400/10 text-blue-400",
  done: "bg-emerald-400/10 text-emerald-400",
  failed: "bg-red-400/10 text-red-400",
};

const WORKER_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  running: { label: "Running", color: "text-blue-400", dot: "bg-blue-400 animate-pulse" },
  idle: { label: "Idle", color: "text-emerald-400", dot: "bg-emerald-400" },
  inactive: { label: "Inactive", color: "text-white/30", dot: "bg-white/20" },
};

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}j`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function jobLabel(job: { type: string; params: Record<string, unknown> }): string {
  if (job.type === "scrape") {
    const sources = (job.params.sources as string[]) ?? [];
    const city = (job.params.city as string) ?? "";
    return `${sources.join("+")} ${city}`.trim();
  }
  if (job.type === "enrich") return "Enrichment";
  if (job.type === "screenshot") return `Screenshot ${(job.params.slug as string) ?? ""}`;
  if (job.type === "email_batch") return "Email batch";
  return job.type;
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10_000); // 10s
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading || !data) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Monitoring</h1>
        <p className="text-white/30 text-sm">Loading...</p>
      </div>
    );
  }

  const ws = WORKER_STATUS[data.worker.status] ?? WORKER_STATUS.inactive;

  return (
    <div className="p-10 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1>
          <p className="text-sm text-white/40 mt-1">Worker, jobs and errors in real time</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
              autoRefresh
                ? "border-emerald-400/30 text-emerald-400 bg-emerald-400/5"
                : "border-white/10 text-white/30 bg-transparent"
            }`}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </button>
          <button
            onClick={fetchData}
            className="text-xs font-mono text-white/40 hover:text-white/70 transition-colors"
          >
            Refresh
          </button>
          <span className="text-[10px] font-mono text-white/20">
            {timeAgo(lastRefresh.toISOString())}
          </span>
        </div>
      </div>

      {/* Worker status */}
      <div className="border border-white/[0.06] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${ws.dot}`} />
          <span className={`text-sm font-medium ${ws.color}`}>Worker: {ws.label}</span>
          {data.worker.last_activity && (
            <span className="text-xs font-mono text-white/20 ml-auto">
              Last activity: {timeAgo(data.worker.last_activity)}
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Pending jobs", value: data.jobs.pending, color: "text-amber-400" },
          { label: "Running jobs", value: data.jobs.running, color: "text-blue-400" },
          { label: "Completed jobs", value: data.jobs.done, color: "text-emerald-400" },
          { label: "Failed jobs", value: data.jobs.failed, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-white/[0.06] rounded-xl px-5 py-4">
            <p className={`text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
            <p className="text-[11px] font-mono text-white/30 mt-2 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total leads", value: data.leads.total, color: "text-white" },
          { label: "Scraped today", value: data.leads.scraped_today, color: "text-blue-400" },
          { label: "Enriched today", value: data.leads.enriched_today, color: "text-emerald-400" },
          { label: "Pending enrichment", value: data.leads.pending_enrichment, color: "text-amber-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-white/[0.06] rounded-xl px-5 py-4">
            <p className={`text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
            <p className="text-[11px] font-mono text-white/30 mt-2 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent jobs table */}
      <section className="border border-white/[0.06] rounded-xl p-5 mb-6">
        <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">
          Recent jobs
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/25 font-mono uppercase tracking-wider">
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Detail</th>
                <th className="text-right py-2 pr-3">Duration</th>
                <th className="text-right py-2 pr-3">Retries</th>
                <th className="text-right py-2">Age</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_jobs.map((job) => (
                <tr key={job.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-2 pr-3 font-mono text-white/60">{job.type}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${STATUS_BG[job.status] ?? "text-white/30"}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-white/40 max-w-[200px] truncate">
                    {jobLabel(job)}
                    {job.progress && (
                      <span className="ml-2 text-white/20">
                        ({Object.entries(job.progress).map(([k, v]) => `${k}: ${v}`).join(", ")})
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-white/30">
                    {job.duration_sec !== null ? formatDuration(job.duration_sec) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {job.retry_count > 0 ? (
                      <span className="text-amber-400">{job.retry_count}/{job.max_retries}</span>
                    ) : (
                      <span className="text-white/15">0</span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono text-white/20">
                    {timeAgo(job.created_at)}
                  </td>
                </tr>
              ))}
              {data.recent_jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-white/20">No jobs</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Error log */}
      <section className="border border-red-400/10 rounded-xl p-5">
        <h2 className="text-[11px] font-mono text-red-400/40 uppercase tracking-wider mb-4">
          Recent errors
        </h2>
        {data.recent_errors.length === 0 ? (
          <p className="text-xs text-white/20">No errors</p>
        ) : (
          <div className="space-y-3">
            {data.recent_errors.map((err) => (
              <div key={err.id} className="border border-white/[0.04] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-red-400">{err.type}</span>
                    <span className="text-[10px] text-white/20 font-mono">
                      {jobLabel({ type: err.type, params: err.params })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {err.retry_count > 0 && (
                      <span className="text-[10px] font-mono text-amber-400/60">
                        {err.retry_count} retries
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-white/15">
                      {err.finished_at ? timeAgo(err.finished_at) : "—"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-red-400/60 font-mono break-all">
                  {err.last_error || err.error || "Unknown error"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
