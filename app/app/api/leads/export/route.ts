import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Actual lead columns pulled from the DB (slug is needed to build site_link).
const LEAD_FIELDS = [
  "email", "name", "category", "slug", "city", "country", "address", "phone", "website",
  "facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube",
  "rating", "reviews_count", "warm_score",
  "seo_score", "mobile_score", "has_chat", "chatbot_opportunity", "review_pain",
  "has_website", "https", "mobile_friendly",
  "sources", "scraped_at",
] as const;

// CSV columns in order. This CSV feeds YOUR LLM: it carries the context needed to
// write a personalized pitch (name, city, reviews, the gaps) + `site_link`, which
// is COMPUTED (niche template base URL + slug). The LLM adds subject/body itself.
const CSV_COLUMNS = [
  "email", "site_link",
  "name", "category", "city", "country", "address", "phone", "website",
  "facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube",
  "rating", "reviews_count", "warm_score",
  "seo_score", "mobile_score", "has_chat", "chatbot_opportunity", "review_pain",
  "has_website", "https", "mobile_friendly",
  "sources", "scraped_at",
] as const;

function escapeCsv(val: unknown): string {
  if (val == null) return "";
  const str = Array.isArray(val) ? val.join(", ") : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const WORKSPACE_ID = session.workspaceId;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const city = url.searchParams.get("city");
  const status = url.searchParams.get("status");
  const minScore = url.searchParams.get("minScore");
  const hasEmail = url.searchParams.get("hasEmail");

  let query = supabaseAdmin()
    .from("leads")
    .select(LEAD_FIELDS.join(", "))
    .eq("workspace_id", WORKSPACE_ID)
    .order("warm_score", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (category) query = query.eq("category", category);
  if (city) query = query.eq("city", city);
  if (status) query = query.eq("status", status);
  if (minScore) query = query.gte("warm_score", Number(minScore));
  if (hasEmail === "true") query = query.not("email", "is", null);

  // Niche → template base URL, to compute each lead's personalized site link.
  const { data: nt } = await supabaseAdmin()
    .from("niche_templates")
    .select("category, base_url")
    .eq("workspace_id", WORKSPACE_ID);
  const baseByCategory: Record<string, string> = {};
  for (const m of nt ?? []) baseByCategory[m.category as string] = m.base_url as string;

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const header = CSV_COLUMNS.join(",");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines = rows.map((row: any) =>
    CSV_COLUMNS.map((col) => {
      if (col === "site_link") {
        const base = baseByCategory[row.category];
        return base && row.slug ? escapeCsv(`${base.replace(/\/+$/, "")}/${row.slug}`) : "";
      }
      return escapeCsv(row[col]);
    }).join(",")
  );

  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
