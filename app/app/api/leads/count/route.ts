import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";
import { applyLeadFilters } from "@/lib/leadFilters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const city = url.searchParams.get("city");
  const country = url.searchParams.get("country");
  const status = url.searchParams.get("status");
  const minScore = url.searchParams.get("minScore");
  const maxReviews = url.searchParams.get("maxReviews");
  const minReviews = url.searchParams.get("minReviews");
  const hasEmail = url.searchParams.get("hasEmail");

  let query = supabaseAdmin()
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", WORKSPACE_ID);

  query = applyLeadFilters(query, { category, city, country, minScore, maxReviews, minReviews });
  if (status) query = query.eq("status", status);
  if (hasEmail === "true") query = query.not("email", "is", null);

  const { count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}
