import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { slug } = await params;

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
  }

  return NextResponse.json({ lead: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { slug } = await params;
  const body = await req.json();

  const allowed = ["status", "notes", "subject", "outreach_channel", "outreach_at", "outreach_status", "follow_up_at", "follow_up_count"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable field" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .update(updates)
    .eq("workspace_id", WORKSPACE_ID)
    .eq("slug", slug)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { slug } = await params;

  const { error } = await supabaseAdmin()
    .from("leads")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .eq("slug", slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
