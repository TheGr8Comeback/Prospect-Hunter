import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { InfoTip } from "@/components/Tooltip";
import { GLOSSARY } from "@/lib/glossary";

export const dynamic = "force-dynamic";

// "X ago" — compact relative time from an ISO string.
function ago(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return new Date(iso).toLocaleDateString("en-US");
}

type Row = {
  name: string;
  slug: string;
  warm_score: number | null;
  city: string | null;
  visit_count: number | null;
  last_visited_at: string | null;
  first_engaged_at: string | null;
  last_opened_at: string | null;
};

const COLS =
  "name, slug, warm_score, city, visit_count, last_visited_at, first_engaged_at, last_opened_at";

export default async function EngagementPage() {
  const { workspaceId: WORKSPACE_ID } = await getSession();

  const [{ data: engagedRaw }, { data: openedRaw }] = await Promise.all([
    // Real, human visits — the follow-up list.
    supabaseAdmin()
      .from("leads")
      .select(COLS)
      .eq("workspace_id", WORKSPACE_ID)
      .gt("visit_count", 0)
      .order("last_visited_at", { ascending: false })
      .limit(100),
    // Opened but never engaged — a softer signal.
    supabaseAdmin()
      .from("leads")
      .select(COLS)
      .eq("workspace_id", WORKSPACE_ID)
      .not("last_opened_at", "is", null)
      .or("visit_count.is.null,visit_count.eq.0")
      .order("last_opened_at", { ascending: false })
      .limit(50),
  ]);

  const engaged = (engagedRaw ?? []) as Row[];
  const opened = (openedRaw ?? []) as Row[];

  return (
    <div className="p-10 max-w-5xl">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Engagement</h1>
        <p className="text-sm text-white/40 mt-1">
          Prospects who opened their personal site — your follow-up list.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="border border-white/[0.06] rounded-xl p-5">
          <div className="text-3xl font-semibold text-emerald-400">{engaged.length}</div>
          <p className="text-[11px] font-mono text-white/30 mt-2 uppercase tracking-wider">
            🔥 Hot prospects (real visit)<InfoTip text={GLOSSARY.visit_count} />
          </p>
        </div>
        <div className="border border-white/[0.06] rounded-xl p-5">
          <div className="text-3xl font-semibold text-white/70">{opened.length}</div>
          <p className="text-[11px] font-mono text-white/30 mt-2 uppercase tracking-wider">
            👀 Opened, no engagement<InfoTip text={GLOSSARY.last_opened_at} />
          </p>
        </div>
      </div>

      {/* Engaged — the hot list */}
      <section className="mb-10">
        <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">
          🔥 Hot prospects
        </h2>
        {engaged.length === 0 ? (
          <p className="text-sm text-white/30 border border-white/[0.06] rounded-xl p-5">
            No real visits yet. As soon as a prospect opens their site, they
            show up here (and you get a Slack ping).
          </p>
        ) : (
          <div className="border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
            {engaged.map((l) => (
              <Link
                key={l.slug}
                href={`/leads/${l.slug}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-base">{l.first_engaged_at ? "🔥" : "🔄"}</span>
                <span className="flex-1 text-sm text-white/80 font-medium truncate">{l.name}</span>
                <span className="text-[11px] font-mono text-white/40">
                  {l.warm_score ?? "—"}
                </span>
                <span className="text-[11px] text-white/30 w-24 truncate">{l.city ?? "—"}</span>
                <span className="text-[11px] font-mono text-white/50 w-20 text-right">
                  {l.visit_count} visit{(l.visit_count ?? 0) > 1 ? "s" : ""}
                </span>
                <span className="text-[11px] text-white/30 w-28 text-right">{ago(l.last_visited_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Opened only — softer */}
      {opened.length > 0 && (
        <section>
          <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">
            👀 Opened, no engagement
          </h2>
          <div className="border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
            {opened.map((l) => (
              <Link
                key={l.slug}
                href={`/leads/${l.slug}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-base opacity-50">👀</span>
                <span className="flex-1 text-sm text-white/60 truncate">{l.name}</span>
                <span className="text-[11px] font-mono text-white/40">
                  {l.warm_score ?? "—"}
                </span>
                <span className="text-[11px] text-white/30 w-24 truncate">{l.city ?? "—"}</span>
                <span className="text-[11px] text-white/30 w-28 text-right">{ago(l.last_opened_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
