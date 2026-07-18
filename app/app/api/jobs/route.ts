import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";
import { createJobSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// POST /api/jobs — créer un job de scraping
export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  try {
    const raw = await req.json();
    const parsed = createJobSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
      .from("jobs")
      .insert({
        workspace_id: WORKSPACE_ID,
        type:         parsed.data.type,
        params:       parsed.data.params,
        status:       "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ job: data }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/jobs — supprimer tous les jobs terminés
export async function DELETE() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { error } = await supabaseAdmin()
    .from("jobs")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .in("status", ["done", "failed"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET /api/jobs — liste des jobs récents
export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { data, error } = await supabaseAdmin()
    .from("jobs")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}
