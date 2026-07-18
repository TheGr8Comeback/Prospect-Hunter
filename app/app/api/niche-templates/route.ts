import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/niche-templates
// Returns the niche→URL mappings + the list of niches actually scraped
// (distinct categories present in the workspace's leads), so the UI can list
// every niche even before a URL is set.
export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WS = session.workspaceId;

  const [{ data: maps }, { data: cats }] = await Promise.all([
    supabaseAdmin().from("niche_templates").select("category, base_url").eq("workspace_id", WS),
    supabaseAdmin().from("leads").select("category").eq("workspace_id", WS).not("category", "is", null),
  ]);

  const categories = [...new Set((cats ?? []).map((c) => c.category as string))].sort();
  const urls: Record<string, string> = {};
  for (const m of maps ?? []) urls[m.category as string] = m.base_url as string;

  return NextResponse.json({ categories, urls });
}

// POST /api/niche-templates  { category, base_url }
// Upsert one mapping. Empty base_url removes it.
export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WS = session.workspaceId;

  const { category, base_url } = await req.json();
  if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });

  if (!base_url?.trim()) {
    await supabaseAdmin().from("niche_templates").delete().eq("workspace_id", WS).eq("category", category);
    return NextResponse.json({ ok: true, removed: true });
  }

  // Normalise: strip trailing slash so we can safely append /slug.
  const clean = base_url.trim().replace(/\/+$/, "");
  const { error } = await supabaseAdmin()
    .from("niche_templates")
    .upsert({ workspace_id: WS, category, base_url: clean, updated_at: new Date().toISOString() },
            { onConflict: "workspace_id,category" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, base_url: clean });
}
