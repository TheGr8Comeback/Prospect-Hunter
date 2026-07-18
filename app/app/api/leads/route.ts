import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/leads?status=draft&category=hvac&limit=50&offset=0
export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status");
  const category = searchParams.get("category");
  const limit    = parseInt(searchParams.get("limit")  ?? "50");
  const offset   = parseInt(searchParams.get("offset") ?? "0");

  let query = supabaseAdmin()
    .from("leads")
    .select("*", { count: "exact" })
    .eq("workspace_id", WORKSPACE_ID)
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)   query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data, total: count });
}
