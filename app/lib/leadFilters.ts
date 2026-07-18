/**
 * Shared lead-targeting filters for campaigns.
 *
 * Single source of truth so the three places that select leads stay in sync:
 *   - campaign creation count   (api/campaigns POST)
 *   - campaign materialization  (api/campaigns/[id] launch → campaign_leads)
 *   - UI live preview count     (api/leads/count)
 *
 * `maxReviews` / `minReviews` are the "ideal buyer" levers: few reviews =
 * small, owner-operated business that decides fast. (Email is already
 * required by the campaign query, so it isn't re-filtered here.)
 *
 * Note: once a reviews filter is set, leads with NULL reviews_count are
 * excluded (Postgres NULL comparison) — intentional, we can't confirm size.
 */
export type LeadFilters = {
  category?: string | null;
  city?: string | null;
  country?: string | null;
  minScore?: string | null;   // website-quality score (legacy; high = good site = poor prospect)
  maxReviews?: string | null;
  minReviews?: string | null;
};

export function applyLeadFilters<Q>(query: Q, filters: LeadFilters): Q {
  // Supabase's PostgrestFilterBuilder is chainable (each call returns the
  // same builder); `any` keeps this wrapper generic over its concrete type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  if (filters.category)   q = q.eq("category", filters.category);
  if (filters.city)       q = q.eq("city", filters.city);
  if (filters.country)    q = q.eq("country", filters.country);
  if (filters.minScore)   q = q.gte("score", Number(filters.minScore));
  if (filters.maxReviews) q = q.lte("reviews_count", Number(filters.maxReviews));
  if (filters.minReviews) q = q.gte("reviews_count", Number(filters.minReviews));
  return q as Q;
}
