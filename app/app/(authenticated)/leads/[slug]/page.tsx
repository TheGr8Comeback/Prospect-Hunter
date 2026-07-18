import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import type { Lead } from "@/lib/types";
import { notFound } from "next/navigation";
import BackLink from "./BackLink";
import { InfoTip } from "@/components/Tooltip";
import { GLOSSARY } from "@/lib/glossary";
import { CopyLink } from "@/components/CopyLink";

export const dynamic = "force-dynamic";

const SOCIAL_ICONS: Record<string, string> = {
  facebook: "FB",
  instagram: "IG",
  linkedin: "IN",
  twitter: "X",
  tiktok: "TK",
  youtube: "YT",
};

// On-page SEO checks from seo_detail. `invert` = the good state is `false`
// (e.g. noindex: true means deindexed from Google → shown as "Indexable ✗").
const SEO_SIGNALS: { key: string; label: string; invert?: boolean }[] = [
  { key: "title", label: "Title" },
  { key: "meta_description", label: "Meta desc" },
  { key: "h1", label: "H1" },
  { key: "single_h1", label: "Single H1" },
  { key: "canonical", label: "Canonical" },
  { key: "open_graph", label: "Open Graph" },
  { key: "schema_org", label: "Schema.org" },
  { key: "twitter_card", label: "Twitter card" },
  { key: "lang", label: "Lang attr" },
  { key: "noindex", label: "Indexable", invert: true },
];

export default async function LeadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspaceId: WORKSPACE_ID } = await getSession();

  const { data } = await supabaseAdmin()
    .from("leads")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("slug", slug)
    .single();

  if (!data) notFound();
  const lead = data as Lead;

  // Personalized site URL = the niche's template base URL + this lead's slug.
  let personalSiteUrl: string | null = null;
  if (lead.category) {
    const { data: nt } = await supabaseAdmin()
      .from("niche_templates")
      .select("base_url")
      .eq("workspace_id", WORKSPACE_ID)
      .eq("category", lead.category)
      .single();
    if (nt?.base_url) personalSiteUrl = `${(nt.base_url as string).replace(/\/+$/, "")}/${lead.slug}`;
  }

  const socials = (["facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube"] as const)
    .filter((k) => lead[k]);
  const techStack = lead.tech_stack ?? [];
  const seoDetail = (lead.seo_detail ?? null) as Record<string, boolean | number> | null;
  const imgAltRatio = typeof seoDetail?.img_alt_ratio === "number" ? seoDetail.img_alt_ratio : null;

  return (
    <div className="p-10 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/30 mb-6">
        <BackLink />
        <span className="text-white/15">/</span>
        <span className="text-white/60">{lead.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
          <p className="text-sm text-white/40 mt-1">
            {[lead.city, lead.region, lead.country].filter(Boolean).join(", ")}
            {lead.category && (
              <span className="ml-3 text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-white/40">
                {lead.category}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`text-4xl font-semibold tabular-nums ${
              (lead.warm_score ?? 0) >= 70
                ? "text-emerald-400"
                : (lead.warm_score ?? 0) >= 40
                  ? "text-amber-400"
                  : "text-white/40"
            }`}
          >
            {lead.warm_score ?? "—"}
          </p>
          <p className="text-[11px] font-mono text-white/25 mt-1">warm / 100</p>
        </div>
      </div>

      {/* Personal site — the link to send (niche template URL + slug) */}
      <section className="border border-cyan-500/20 bg-cyan-500/[0.03] rounded-xl p-4 mb-6">
        <h2 className="text-[11px] font-mono text-white/30 uppercase tracking-wider mb-3">
          🌐 Personal site — the link to send
        </h2>
        <CopyLink url={personalSiteUrl} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact */}
          <section className="border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">
              Contact
            </h2>
            <div className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400/70 w-5 text-center">✉</span>
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-sm text-white/70 hover:text-white transition-colors font-mono"
                  >
                    {lead.email}
                  </a>
                  {lead.email_status && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        lead.email_status === "valid"
                          ? "bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/20"
                          : lead.email_status === "invalid"
                            ? "bg-red-500/10 text-red-400/70 border border-red-500/20"
                            : lead.email_status === "catch_all"
                              ? "bg-amber-500/10 text-amber-400/70 border border-amber-500/20"
                              : lead.email_status === "mx_valid"
                                ? "bg-sky-500/10 text-sky-400/70 border border-sky-500/20"
                                : "bg-white/[0.05] text-white/30 border border-white/10"
                      }`}
                    >
                      {lead.email_status === "valid" ? "verified"
                        : lead.email_status === "invalid" ? "invalid"
                        : lead.email_status === "catch_all" ? "catch-all"
                        : lead.email_status === "mx_valid" ? "MX ok"
                        : "unverified"}
                    </span>
                  )}
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <span className="text-blue-400/70 w-5 text-center">☎</span>
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-sm text-white/70 hover:text-white transition-colors font-mono"
                  >
                    {lead.phone_raw ?? lead.phone}
                  </a>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-3">
                  <span className="text-purple-400/70 w-5 text-center">⌂</span>
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/70 hover:text-white transition-colors truncate"
                  >
                    {lead.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {lead.address && (
                <div className="flex items-center gap-3">
                  <span className="text-white/30 w-5 text-center">◎</span>
                  <span className="text-sm text-white/50">{lead.address}</span>
                </div>
              )}
            </div>
          </section>

          {/* Web presence & gap */}
          <section className="border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">Web presence</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-xs font-mono px-2 py-1 rounded border ${
                lead.no_real_website ? "text-red-400 bg-red-500/10 border-red-500/25"
                : lead.free_builder ? "text-amber-400 bg-amber-500/10 border-amber-500/25"
                : "text-white/50 bg-white/[0.04] border-white/10"
              }`}>
                {lead.no_real_website ? (lead.facebook ? "Facebook-only" : "No real website") : lead.free_builder ? "Free builder" : lead.website_kind ?? (lead.has_website ? "Has site" : "No site")}
              </span>
              {[
                { label: "Online booking", val: lead.has_online_booking },
                { label: "Click-to-call", val: lead.has_click_to_call },
                { label: "Contact form", val: lead.has_contact_form },
              ].map((c) => (
                <span key={c.label} className={`text-[10px] font-mono px-2 py-1 rounded border ${c.val ? "text-emerald-400/70 bg-emerald-500/5 border-emerald-500/20" : "text-white/25 bg-white/[0.02] border-white/[0.06]"}`}>
                  {c.val ? "✓" : "✗"} {c.label}
                </span>
              ))}
            </div>
            {(lead.mobile_score != null || lead.perf_score != null) && (
              <div className="flex gap-6 text-xs">
                {lead.mobile_score != null && <span className="font-mono text-white/40">Mobile perf<InfoTip text={GLOSSARY.mobile_score} /> <span className={lead.mobile_score >= 50 ? "text-emerald-400" : "text-red-400/70"}>{lead.mobile_score}</span>/100</span>}
                {lead.perf_score != null && <span className="font-mono text-white/40">Desktop <span className={lead.perf_score >= 50 ? "text-emerald-400" : "text-red-400/70"}>{lead.perf_score}</span>/100</span>}
              </div>
            )}
          </section>

          {/* Website signals */}
          {lead.has_website && (
            <section className="border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">
                Website signals
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "HTTPS", val: lead.https, good: true },
                  { label: "Mobile", val: lead.mobile_friendly, good: true },
                  { label: "Meta desc", val: lead.meta_desc_present, good: true },
                  { label: "Favicon", val: lead.favicon_present, good: true },
                  { label: "Title", val: lead.title_present, good: true },
                  {
                    label: "Copyright",
                    val: lead.copyright_year,
                    good: lead.copyright_year != null && lead.copyright_year >= 2022,
                    display: lead.copyright_year ? `© ${lead.copyright_year}` : null,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`px-3 py-2 rounded-lg border text-xs font-mono ${
                      s.val
                        ? s.good
                          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400/70"
                          : "border-amber-500/20 bg-amber-500/5 text-amber-400/70"
                        : "border-white/[0.06] bg-white/[0.02] text-white/25"
                    }`}
                  >
                    {s.label}{" "}
                    <span className="float-right">
                      {"display" in s && s.display ? s.display : s.val ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
              </div>
              {(techStack.length > 0 || lead.response_time_ms || lead.html_size_kb) && (
                <div className="flex flex-wrap gap-3 mt-4 text-xs text-white/30 font-mono">
                  {techStack.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-white/[0.04]">
                      {t}
                    </span>
                  ))}
                  {lead.response_time_ms && <span>{lead.response_time_ms}ms</span>}
                  {lead.html_size_kb && <span>{lead.html_size_kb}kb</span>}
                  {lead.status_code && <span>HTTP {lead.status_code}</span>}
                </div>
              )}
            </section>
          )}

          {/* SEO & chat — per-service opportunity signals */}
          {(lead.seo_score != null || lead.has_chat != null) && (
            <section className="border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider">
                  On-page SEO<InfoTip text={GLOSSARY.seo_score} />
                </h2>
                {lead.seo_score != null && (
                  <span className={`text-sm font-mono ${
                    lead.seo_score >= 70 ? "text-emerald-400"
                    : lead.seo_score >= 40 ? "text-amber-400"
                    : "text-red-400/80"
                  }`}>
                    {lead.seo_score}<span className="text-white/25">/100</span>
                  </span>
                )}
              </div>

              {seoDetail && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SEO_SIGNALS.map((s) => {
                    const raw = !!seoDetail[s.key];
                    const val = s.invert ? !raw : raw;
                    return (
                      <div
                        key={s.key}
                        className={`px-3 py-2 rounded-lg border text-xs font-mono ${
                          val
                            ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400/70"
                            : "border-red-500/20 bg-red-500/5 text-red-400/70"
                        }`}
                      >
                        {s.label}{" "}
                        <span className="float-right">{val ? "✓" : "✗"}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {imgAltRatio != null && (
                <p className="mt-3 text-[11px] font-mono text-white/30">
                  Image alt-text{" "}
                  <span className={imgAltRatio >= 0.8 ? "text-emerald-400/70" : "text-amber-400/70"}>
                    {Math.round(imgAltRatio * 100)}%
                  </span>
                </p>
              )}

              {seoDetail?.noindex === true && (
                <p className="mt-3 text-[11px] text-red-400/70">
                  ⚠ Deindexed (noindex) — invisible on Google
                </p>
              )}

              {/* Live chat / chatbot opportunity */}
              {lead.has_chat != null && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <p className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-2">Live chat<InfoTip text={GLOSSARY.has_chat} /></p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {lead.has_chat ? (
                      <span className="font-mono px-2.5 py-1 rounded-lg border text-white/50 bg-white/[0.04] border-white/10">
                        ✓ Already has chat{lead.chat_vendor ? ` — ${lead.chat_vendor}` : ""}
                      </span>
                    ) : lead.chatbot_opportunity ? (
                      <span className="font-mono px-2.5 py-1 rounded-lg border text-cyan-400 bg-cyan-500/10 border-cyan-500/30">
                        ◆ Chatbot opportunity<InfoTip text={GLOSSARY.chatbot_opportunity} />
                      </span>
                    ) : (
                      <span className="font-mono px-2.5 py-1 rounded-lg border text-amber-400/80 bg-amber-500/[0.08] border-amber-500/25">
                        No chatbot — one to sell
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Website screenshot */}
          {lead.screenshot_url && (
            <section className="border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">Website screenshot</h2>
              <a href={lead.website ?? "#"} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lead.screenshot_url} alt="Website screenshot" className="rounded-lg border border-white/10 w-full" />
              </a>
            </section>
          )}

          {/* Socials */}
          {socials.length > 0 && (
            <section className="border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">
                Social networks
              </h2>
              <div className="flex flex-wrap gap-2">
                {socials.map((key) => (
                  <a
                    key={key}
                    href={lead[key]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs font-mono text-white/50 hover:text-white hover:border-white/20 transition-colors"
                  >
                    {SOCIAL_ICONS[key] ?? key}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Reviews & pain signals */}
          {(lead.review_velocity != null || (lead.review_pain_quotes && lead.review_pain_quotes.length > 0) || (lead.reviews_text && lead.reviews_text.length > 0)) && (
            <section className="border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">Reviews</h2>
              <div className="flex items-center gap-4 text-xs mb-3">
                {lead.rating && <span className="text-amber-400/70">{lead.rating}★ <span className="text-white/30">({lead.reviews_count ?? 0})</span></span>}
                {lead.review_velocity != null && <span className="font-mono text-white/40">{lead.review_velocity} recent/mo</span>}
                {lead.review_pain != null && lead.review_pain > 0 && <span className="font-mono text-red-400/70">{lead.review_pain} pain signal{lead.review_pain > 1 ? "s" : ""}<InfoTip text={GLOSSARY.review_pain} /></span>}
              </div>
              {lead.review_pain_quotes && lead.review_pain_quotes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-red-400/50 uppercase tracking-wider">Complaints — pitch angle</p>
                  {lead.review_pain_quotes.slice(0, 4).map((q, i) => (
                    <p key={i} className="text-xs text-white/50 italic border-l-2 border-red-500/20 pl-3">&ldquo;{q}&rdquo;</p>
                  ))}
                </div>
              ) : lead.reviews_text && lead.reviews_text.length > 0 ? (
                <div className="space-y-2">
                  {lead.reviews_text.slice(0, 3).map((q, i) => (
                    <p key={i} className="text-xs text-white/40 italic border-l-2 border-white/10 pl-3">&ldquo;{q}&rdquo;</p>
                  ))}
                </div>
              ) : null}
            </section>
          )}

        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Qualification (warm score) */}
          {(lead.warm_score != null || (lead.hooks && lead.hooks.length > 0)) && (
            <section className="border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">
                Qualification<InfoTip text={GLOSSARY.warm_score} />
              </h2>
              {lead.warm_detail && (
                <div className="mt-4 space-y-2">
                  {(["pain", "money", "intent"] as const).map((k) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-white/30 w-12 capitalize">{k}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400/60" style={{ width: `${Math.min(((lead.warm_detail?.[k] ?? 0) / 40) * 100, 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-white/40 w-6 text-right">{lead.warm_detail?.[k] ?? 0}</span>
                    </div>
                  ))}
                </div>
              )}
              {lead.hooks && lead.hooks.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
                  {lead.hooks.map((h, i) => (
                    <li key={i} className="text-xs text-white/50 flex gap-2"><span className="text-amber-400/50">→</span><span>{h}</span></li>
                  ))}
                </ul>
              )}
              {lead.disqualified && lead.disqualified_reason && (
                <p className="mt-3 text-[11px] text-red-400/60">⚠ Disqualified: {lead.disqualified_reason}</p>
              )}
            </section>
          )}

          <section className="border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-[11px] font-mono text-white/25 uppercase tracking-wider mb-4">
              Infos
            </h2>
            <div className="space-y-2 text-xs text-white/40">
              {lead.opening_hours && (
                <p>
                  <span className="text-white/25">Hours</span>{" "}
                  <span className="text-white/50">{lead.opening_hours}</span>
                </p>
              )}
              {lead.rating && (
                <p>
                  <span className="text-white/25">Rating</span>{" "}
                  <span className="text-amber-400/70">{lead.rating}/5</span>
                  {lead.reviews_count && (
                    <span className="text-white/30"> ({lead.reviews_count} reviews)</span>
                  )}
                </p>
              )}
              {lead.business_size && (
                <p><span className="text-white/25">Size</span>{" "}<span className="text-white/50">{lead.business_size}</span></p>
              )}
              {lead.ad_active && (
                <p><span className="text-white/25">Ads</span>{" "}<span className="text-emerald-400/70">running{lead.ad_platforms && lead.ad_platforms.length ? ` (${lead.ad_platforms.join(", ")})` : ""}</span></p>
              )}
              {lead.is_recently_opened && (
                <p className="text-emerald-400/60">Recently opened</p>
              )}
              <p>
                <span className="text-white/25">Sources</span>{" "}
                {(lead.sources ?? []).join(", ")}
              </p>
              <p>
                <span className="text-white/25">Scraped</span>{" "}
                {new Date(lead.scraped_at).toLocaleDateString("en-US")}
              </p>
              {lead.enriched_at && (
                <p>
                  <span className="text-white/25">Enriched</span>{" "}
                  {new Date(lead.enriched_at).toLocaleDateString("en-US")}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
