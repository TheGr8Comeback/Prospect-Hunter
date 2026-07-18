import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { slug } = await params;
  const { action } = await req.json() as { action: string };

  if (action !== "screenshot") {
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("jobs")
    .insert({
      workspace_id: WORKSPACE_ID,
      type: action,
      params: { slug },
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job: data }, { status: 201 });
}
