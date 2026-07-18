import { Suspense } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import type { Lead } from "@/lib/types";
import LeadsList from "./LeadsList";

export const dynamic = "force-dynamic";

// Supabase caps each response at 1000 rows. To get every distinct value of a
// column across all leads, page through in 1000-row chunks and dedupe.
async function fetchDistinct(column: "category" | "city", workspaceId: string): Promise<string[]> {
  const values = new Set<string>();
  const CHUNK = 1000;
  for (let from = 0; ; from += CHUNK) {
    const { data } = await supabaseAdmin()
      .from("leads")
      .select(column)
      .eq("workspace_id", workspaceId)
      .not(column, "is", null)
      .order(column)
      .range(from, from + CHUNK - 1);
    const rows = (data ?? []) as Record<string, string>[];
    for (const r of rows) if (r[column]) values.add(r[column]);
    if (rows.length < CHUNK) break;
  }
  return [...values].sort();
}

const PAGE_SIZE = 100;
const COLUMNS = "slug, name, city, category, email, email_status, email_type, phone, rating, reviews_count, has_website, website, website_kind, no_real_website, free_builder, facebook, instagram, linkedin, twitter, tiktok, youtube, sources, warm_score, lead_tier, tier_reason, business_size, seo_score, has_chat, chat_vendor, chatbot_opportunity, enrichment_status, created_at";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { workspaceId: WORKSPACE_ID } = await getSession();
  const page = Math.max(1, Number(params.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseAdmin()
    .from("leads")
    .select(COLUMNS, { count: "exact" })
    .eq("workspace_id", WORKSPACE_ID);

  // Server-side filters
  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,email.ilike.%${params.q}%,city.ilike.%${params.q}%`);
  }
  if (params.cat) query = query.eq("category", params.cat);
  if (params.city) query = query.eq("city", params.city);
  if (params.email === "1") query = query.not("email", "is", null);
  if (params.noweb === "1") query = query.eq("has_website", false);
  if (params.seo === "low") query = query.lte("seo_score", 40);
  if (params.nochat === "1") query = query.eq("has_chat", false);
  // Social-network filter: a specific network present, or "any"/"none".
  const SOCIAL_COLS = ["facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube"];
  if (params.social === "any") {
    query = query.or(SOCIAL_COLS.map((c) => `${c}.not.is.null`).join(","));
  } else if (params.social === "none") {
    // AND of "is null" = just chain the filters (chained filters are AND'd).
    for (const c of SOCIAL_COLS) query = query.is(c, null);
  } else if (params.social && SOCIAL_COLS.includes(params.social)) {
    query = query.not(params.social, "is", null);
  }
  if (Number(params.minrev ?? 0) > 0) query = query.gte("reviews_count", Number(params.minrev));

  // Sort — warm_score first (the war-machine ranking)
  const sortBy = params.sort ?? "warm_score";
  const sortAsc = params.asc === "1";
  if (sortBy === "warm_score" || sortBy === "seo_score") {
    query = query.order(sortBy, { ascending: sortAsc, nullsFirst: false });
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order(sortBy, { ascending: sortAsc });
  }

  query = query.range(from, to);

  const { data, count } = await query;
  const leads = (data ?? []) as Partial<Lead>[];

  // Fetch distinct categories and cities for filter dropdowns.
  // Supabase caps responses at 1000 rows, so a single SELECT only sees the
  // first 1000 (all one category) — paginate through every row to dedupe.
  const [categories, cities] = await Promise.all([
    fetchDistinct("category", WORKSPACE_ID),
    fetchDistinct("city", WORKSPACE_ID),
  ]);

  return (
    <Suspense fallback={<div className="p-10 text-white/30">Loading...</div>}>
      <LeadsList
        leads={leads}
        total={count ?? leads.length}
        categories={categories}
        cities={cities}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </Suspense>
  );
}
