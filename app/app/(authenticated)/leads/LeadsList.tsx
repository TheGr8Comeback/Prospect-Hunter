"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Lead } from "@/lib/types";

const SOCIAL_KEYS = ["facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube"] as const;
const SOCIAL_ICONS: Record<string, { icon: string; color: string }> = {
  facebook:  { icon: "FB", color: "text-blue-400/60" },
  instagram: { icon: "IG", color: "text-pink-400/60" },
  linkedin:  { icon: "IN", color: "text-sky-400/60" },
  twitter:   { icon: "X",  color: "text-white/40" },
  tiktok:    { icon: "TK", color: "text-cyan-400/60" },
  youtube:   { icon: "YT", color: "text-red-400/60" },
};

type SortKey = "warm_score" | "name" | "city" | "reviews_count" | "seo_score";

function webStatus(l: Partial<Lead>): { label: string; cls: string } {
  if (l.no_real_website) return { label: l.facebook ? "FB-only" : "No site", cls: "text-red-400/80" };
  if (l.free_builder)    return { label: "Free builder", cls: "text-amber-400/70" };
  if (l.has_website)     return { label: l.website_kind ?? "Site", cls: "text-white/35" };
  return { label: "—", cls: "text-white/15" };
}

export default function LeadsList({
  leads, total, categories, cities, page, pageSize,
}: {
  leads: Partial<Lead>[];
  total: number;
  categories: string[];
  cities: string[];
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const category = searchParams.get("cat") ?? "";
  const city     = searchParams.get("city") ?? "";
  const hasEmail = searchParams.get("email") === "1";
  const noWebsite = searchParams.get("noweb") === "1";
  const lowSeo   = searchParams.get("seo") === "low";
  const noChat   = searchParams.get("nochat") === "1";
  const social   = searchParams.get("social") ?? "";
  const minRev   = searchParams.get("minrev") ?? "";
  const sortBy   = (searchParams.get("sort") as SortKey) || "warm_score";
  const sortAsc  = searchParams.get("asc") === "1";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "" || v === "0") params.delete(k);
      else params.set(k, v);
    }
    router.push(`/leads?${params.toString()}`, { scroll: false });
  }

  function handleSearch(value: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateParams({ q: value.trim() || null }), 400);
  }

  function toggleSort(key: SortKey) {
    if (sortBy === key) updateParams({ asc: sortAsc ? null : "1" });
    else updateParams({ sort: key === "warm_score" ? null : key, asc: null });
  }

  const totalPages = Math.ceil(total / pageSize);
  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page"); else params.set("page", String(p));
    router.push(`/leads?${params.toString()}`, { scroll: false });
  }

  function toggleSelect(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.slug!)));
  }
  async function deleteSelected() {
    if (selected.size === 0 || !confirm(`Delete ${selected.size} lead(s)?`)) return;
    setDeleting(true);
    await fetch("/api/leads/batch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: [...selected] }),
    });
    setSelected(new Set());
    setDeleting(false);
    router.refresh();
  }

  function exportCsv() {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (city) p.set("city", city);
    if (hasEmail) p.set("hasEmail", "true");
    window.open(`/api/leads/export?${p.toString()}`, "_blank");
  }

  const activeFilters = [category, city, hasEmail, noWebsite, lowSeo, noChat, social, minRev].filter(Boolean).length;
  const inputCls = "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white/60 focus:outline-none focus:border-white/20";

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-white/40 mt-1">
            {total} lead{total !== 1 ? "s" : ""}{activeFilters > 0 && " (filtered)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCsv} className="px-4 py-2 rounded-lg border border-white/[0.08] text-white/50 text-sm font-medium hover:text-white hover:border-white/20 transition-colors">
            Export CSV
          </button>
          <Link href="/jobs/new" className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors">
            + New scrape
          </Link>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          <span className="text-sm text-white/50">{selected.size} selected</span>
          <button onClick={deleteSelected} disabled={deleting} className="text-xs font-mono px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors">
            {deleting ? "..." : "Delete"}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-white/25 hover:text-white/50 ml-auto transition-colors">Deselect</button>
        </div>
      )}

      {/* Filters — qualification only */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          key={searchParams.get("q") ?? ""}
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search..."
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 w-56"
        />
        <select value={category} onChange={(e) => updateParams({ cat: e.target.value || null })} className={inputCls}>
          <option value="" className="bg-[#1a1a1a]">Category</option>
          {categories.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
        </select>
        <select value={city} onChange={(e) => updateParams({ city: e.target.value || null })} className={inputCls}>
          <option value="" className="bg-[#1a1a1a]">City</option>
          {cities.map((c) => <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>)}
        </select>
        <select value={social} onChange={(e) => updateParams({ social: e.target.value || null })} className={inputCls} title="Filter by social-network presence">
          <option value="" className="bg-[#1a1a1a]">Socials</option>
          <option value="any" className="bg-[#1a1a1a]">Any social</option>
          <option value="none" className="bg-[#1a1a1a]">No social</option>
          {SOCIAL_KEYS.map((k) => <option key={k} value={k} className="bg-[#1a1a1a]">{k}</option>)}
        </select>
        <button onClick={() => updateParams({ email: hasEmail ? null : "1" })} className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${hasEmail ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/[0.08] text-white/30 hover:text-white/50"}`}>
          Has email
        </button>
        <button onClick={() => updateParams({ noweb: noWebsite ? null : "1" })} className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${noWebsite ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-white/[0.08] text-white/30 hover:text-white/50"}`}>
          No website
        </button>
        <button onClick={() => updateParams({ seo: lowSeo ? null : "low" })} title="On-page SEO ≤ 40 — weak SEO = opportunity" className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${lowSeo ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-white/[0.08] text-white/30 hover:text-white/50"}`}>
          Weak SEO
        </button>
        <button onClick={() => updateParams({ nochat: noChat ? null : "1" })} title="Site with no live-chat / chatbot widget" className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${noChat ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" : "border-white/[0.08] text-white/30 hover:text-white/50"}`}>
          No chatbot
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-white/25">Min reviews</span>
          <input type="number" min={0} step={10} value={minRev} onChange={(e) => updateParams({ minrev: e.target.value })} placeholder="0" className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white/60 w-16 text-center focus:outline-none focus:border-white/20" />
        </div>
        {activeFilters > 0 && (
          <button onClick={() => router.push("/leads", { scroll: false })} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Reset ({activeFilters})
          </button>
        )}
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <p className="text-4xl mb-4">🎯</p>
          <p>No leads found.</p>
          {activeFilters > 0 && <p className="text-sm mt-2">Adjust your filters.</p>}
        </div>
      ) : (
        <>
          <div className="border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleSelectAll} className="accent-white/60" />
                  </th>
                  {[
                    { key: "name" as SortKey, label: "Name" },
                    { key: "city" as SortKey, label: "City" },
                    { key: null, label: "Cat." },
                    { key: null, label: "Contact" },
                    { key: null, label: "Web" },
                    { key: null, label: "Socials" },
                    { key: "reviews_count" as SortKey, label: "Reviews" },
                    { key: "seo_score" as SortKey, label: "SEO" },
                    { key: null, label: "Chat" },
                    { key: "warm_score" as SortKey, label: "Warm" },
                  ].map(({ key, label }) => (
                    <th
                      key={label}
                      onClick={key ? () => toggleSort(key) : undefined}
                      className={`text-left px-3 py-3 text-[11px] font-mono text-white/25 uppercase tracking-wider ${key ? "cursor-pointer hover:text-white/40 select-none" : ""}`}
                    >
                      {label}{key && sortBy === key && <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {leads.map((lead) => {
                  const socials = SOCIAL_KEYS.filter((k) => lead[k]);
                  const web = webStatus(lead);
                  return (
                    <tr key={lead.slug} className={`hover:bg-white/[0.02] transition-colors ${selected.has(lead.slug!) ? "bg-white/[0.04]" : ""}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(lead.slug!)} onChange={() => toggleSelect(lead.slug!)} className="accent-white/60" />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/leads/${lead.slug}`} className="font-medium hover:text-amber-400 transition-colors">{lead.name}</Link>
                      </td>
                      <td className="px-3 py-3 text-white/50 text-xs">{lead.city ?? "—"}</td>
                      <td className="px-3 py-3">
                        {lead.category ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40">{lead.category}</span> : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          {lead.email && (
                            <span
                              className={lead.email_status === "valid" ? "text-emerald-400" : lead.email_status === "invalid" ? "text-red-400/70 line-through" : lead.email_status === "catch_all" ? "text-amber-400/70" : "text-white/25"}
                              title={`${lead.email} · ${lead.email_status ?? "unverified"}`}
                            >✉</span>
                          )}
                          {lead.phone && <span className="text-blue-400/70" title={lead.phone as string}>☎</span>}
                          {!lead.email && !lead.phone && <span className="text-white/15">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span className={web.cls}>{web.label}</span>
                      </td>
                      <td className="px-3 py-3">
                        {socials.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {socials.map((k) => (
                              <span key={k} className={`text-[9px] font-mono font-bold ${SOCIAL_ICONS[k]?.color ?? "text-white/40"}`} title={lead[k] as string}>
                                {SOCIAL_ICONS[k]?.icon ?? k}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-white/15 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {lead.rating ? <span className="text-amber-400/70" title={`${lead.reviews_count ?? 0} reviews`}>{lead.rating}★ <span className="text-white/30">{lead.reviews_count ?? 0}</span></span> : <span className="text-white/15">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {lead.seo_score != null ? (
                          <span
                            className={`font-mono text-sm ${lead.seo_score <= 40 ? "text-red-400" : lead.seo_score <= 70 ? "text-amber-400/70" : "text-white/30"}`}
                            title="On-page SEO — lower = bigger opportunity"
                          >{lead.seo_score}</span>
                        ) : <span className="text-white/15 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {lead.chatbot_opportunity ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-cyan-400 bg-cyan-500/10 border-cyan-500/30 whitespace-nowrap" title="No chat + service pain in reviews → strong chatbot opportunity">◆ chatbot</span>
                        ) : lead.has_chat === false ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-amber-400/80 bg-amber-500/[0.08] border-amber-500/25 whitespace-nowrap" title="No live-chat / chatbot widget on the site — one to sell">no chatbot</span>
                        ) : lead.has_chat ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-white/40 bg-white/[0.04] border-white/10 whitespace-nowrap" title={`Already has live chat: ${lead.chat_vendor ?? "yes"}`}>✓ {lead.chat_vendor ?? "chat"}</span>
                        ) : <span className="text-white/15">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {lead.warm_score != null ? (
                          <span className={`font-mono text-sm ${lead.warm_score >= 70 ? "text-emerald-400" : lead.warm_score >= 40 ? "text-amber-400" : "text-white/40"}`}>{lead.warm_score}</span>
                        ) : <span className="text-white/20 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-1">
              <p className="text-sm text-white/30">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-sm text-white/40 hover:text-white hover:border-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">Previous</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button key={p} onClick={() => goToPage(p)} className={`w-8 h-8 rounded-lg text-sm font-mono transition-colors ${p === page ? "bg-white text-black" : "text-white/30 hover:text-white hover:bg-white/[0.06]"}`}>{p}</button>
                  );
                })}
                <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-sm text-white/40 hover:text-white hover:border-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
