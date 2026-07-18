"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Job {
  id: string;
  type: string;
  status: string;
  params: Record<string, unknown>;
  progress: { found?: number; enriched?: number; total?: number; skipped?: number } | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

const statusColors: Record<string, string> = {
  pending: "text-amber-400  bg-amber-500/10  border-amber-500/20",
  running: "text-blue-400   bg-blue-500/10   border-blue-500/20",
  done:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  failed:  "text-red-400    bg-red-500/10    border-red-500/20",
};

function elapsed(start: string | null, end: string | null): string {
  if (!start) return "—";
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
}

function ProgressBar({ progress }: { progress: Job["progress"] }) {
  if (!progress) return null;
  const done = progress.found ?? progress.enriched ?? 0;
  const total = progress.total ?? 0;
  if (total === 0) return null;
  const pct = Math.min((done / total) * 100, 100);

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400/60 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-white/30">{done}/{total}</span>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  async function fetchJobs() {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  async function deleteJob(id: string) {
    if (!confirm("Delete this job?")) return;
    setDeleting((prev) => new Set(prev).add(id));
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  const hasActive = jobs.some((j) => j.status === "pending" || j.status === "running");
  const hasFinished = jobs.some((j) => j.status === "done" || j.status === "failed");

  async function deleteAll() {
    if (!confirm("Delete all completed jobs?")) return;
    await fetch("/api/jobs", { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.status === "pending" || j.status === "running"));
  }

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-white/40 mt-1">
            {hasActive && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-2 align-middle" />
            )}
            {hasActive ? "Live updates" : "Job history"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasFinished && (
            <button
              onClick={deleteAll}
              className="px-4 py-2 rounded-lg border border-red-500/20 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
            >
              Delete all
            </button>
          )}
          <Link
            href="/jobs/new"
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            + New job
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 text-white/30">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <p className="text-4xl mb-4">⚙️</p>
          <p>No jobs yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`border rounded-xl px-5 py-4 transition-colors ${
                job.status === "running"
                  ? "border-blue-500/20 bg-blue-500/[0.03]"
                  : "border-white/[0.06]"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Type */}
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-white/40 uppercase w-20 text-center shrink-0">
                  {job.type}
                </span>

                {/* Params + progress */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {job.type === "scrape" ? (
                      <>
                        {job.params.category as string ?? "—"} · {job.params.city as string ?? "—"} · {job.params.country as string ?? "—"}
                        {job.params.maxResults != null && (
                          <span className="text-white/20 font-mono text-xs ml-2">
                            max {String(job.params.maxResults)}
                          </span>
                        )}
                        {job.params.noWebsiteOnly === true && (
                          <span className="text-emerald-400/70 font-mono text-xs ml-2">no-site</span>
                        )}
                        {job.params.requireEmail === true && (
                          <span className="text-emerald-400/70 font-mono text-xs ml-2">+email</span>
                        )}
                      </>
                    ) : job.type === "enrich" || job.type === "re-enrich" ? (
                      <>
                        {job.progress?.total != null
                          ? `${job.progress.total} leads`
                          : "Enriching leads"}
                        {job.params.target && (
                          <span className="text-white/20 font-mono text-xs ml-2">
                            target: {String(job.params.target)}
                          </span>
                        )}
                      </>
                    ) : job.type === "email_batch" ? (
                      "Sending emails"
                    ) : (
                      Object.entries(job.params)
                        .filter(([k]) => k !== "concurrency")
                        .map(([, v]) => String(v))
                        .join(" · ") || "—"
                    )}
                  </p>
                  {job.progress && (
                    <p className="text-xs text-white/30 mt-0.5 font-mono">
                      {job.type === "scrape" ? (
                        <>
                          {job.progress.found ?? 0} found
                          {job.progress.enriched != null && ` · ${job.progress.enriched} enriched`}
                        </>
                      ) : (
                        <>
                          {job.progress.enriched ?? 0}/{job.progress.total ?? "?"} enriched
                          {job.progress.skipped != null && job.progress.skipped > 0 && (
                            <span className="text-white/20"> · {job.progress.skipped} skipped</span>
                          )}
                        </>
                      )}
                    </p>
                  )}
                  {job.status === "running" && <ProgressBar progress={job.progress} />}
                  {job.error && (
                    <p className="text-xs text-red-400/70 mt-1 truncate">{job.error}</p>
                  )}
                </div>

                {/* Sources */}
                {Array.isArray(job.params.sources) && (
                  <div className="flex gap-1 shrink-0">
                    {(job.params.sources as string[]).map((s) => (
                      <span key={s} className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/[0.04] text-white/25">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Duration */}
                <span className="text-xs font-mono text-white/30 shrink-0 w-14 text-right">
                  {job.status === "running" ? elapsed(job.started_at, null) : elapsed(job.started_at, job.finished_at)}
                </span>

                {/* Status */}
                <span className={`text-[11px] font-mono px-2.5 py-1 rounded-md border capitalize shrink-0 ${statusColors[job.status]}`}>
                  {job.status === "running" && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-1.5 align-middle" />
                  )}
                  {job.status}
                </span>

                {/* Delete */}
                <button
                  onClick={() => deleteJob(job.id)}
                  disabled={deleting.has(job.id) || job.status === "running"}
                  className="text-white/15 hover:text-red-400 disabled:opacity-30 transition-colors shrink-0 text-sm"
                  title="Delete"
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
