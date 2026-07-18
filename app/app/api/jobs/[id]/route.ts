import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";


export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { id } = await params;

  const { error } = await supabaseAdmin()
    .from("jobs")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
