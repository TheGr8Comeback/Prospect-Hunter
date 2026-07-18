import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { slugs } = await req.json() as { slugs: string[] };

  if (!Array.isArray(slugs) || slugs.length === 0) {
    return NextResponse.json({ error: "slugs[] requis" }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("leads")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .in("slug", slugs);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: slugs.length });
}

// PATCH /api/leads/batch — bulk update status
export async function PATCH(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { slugs, status } = await req.json() as { slugs: string[]; status: string };

  if (!Array.isArray(slugs) || slugs.length === 0) {
    return NextResponse.json({ error: "slugs[] requis" }, { status: 400 });
  }

  const allowed = ["draft", "sent", "opened", "replied", "archived"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `status invalide : ${status}` }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("workspace_id", WORKSPACE_ID)
    .in("slug", slugs);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: slugs.length, status });
}
