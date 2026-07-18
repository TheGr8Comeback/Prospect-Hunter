"use client";

import { useEffect, useState } from "react";

export default function SitesPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/niche-templates");
      const d = await r.json();
      setCategories(d.categories ?? []);
      setUrls(d.urls ?? {});
      setLoading(false);
    })();
  }, []);

  const save = async (category: string) => {
    await fetch("/api/niche-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, base_url: urls[category] ?? "" }),
    });
    setSaved(category);
    setTimeout(() => setSaved(null), 1500);
  };

  return (
    <div className="p-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
        <p className="text-sm text-white/40 mt-1">
          Paste the URL of your deployed template for each niche. Every lead will
          then show its personal link (URL + slug), ready to copy.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-white/30">Loading…</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-white/30 border border-white/[0.06] rounded-xl p-5">
          No niche scraped yet. Run a scrape, then come back here to hook up your template.
        </p>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const url = urls[cat] ?? "";
            const preview = url ? `${url.replace(/\/+$/, "")}/example-slug` : null;
            return (
              <div key={cat} className="border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white/80 w-32 truncate">{cat}</span>
                  <input
                    placeholder="https://your-template.netlify.app/"
                    value={url}
                    onChange={(e) => setUrls({ ...urls, [cat]: e.target.value })}
                    onBlur={() => save(cat)}
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={() => save(cat)}
                    className="text-xs px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                  >
                    {saved === cat ? "✓" : "OK"}
                  </button>
                </div>
                {preview && (
                  <p className="text-[11px] text-white/30 mt-2 font-mono truncate">→ {preview}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
