import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("name, slug, city, country, category, website, phone, address, rating, email")
    .eq("workspace_id", WORKSPACE_ID)
    .not("email", "is", null)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}
