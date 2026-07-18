"use client";

import { useState } from "react";

// The lead's personalized site URL + a one-click copy (the core outreach gesture)
// and an Open button. If no URL, shows a hint pointing to the Sites page.
export function CopyLink({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return (
      <a href="/sites" className="text-[11px] text-amber-400/70 hover:text-amber-400">
        ⚙️ Set the template URL for this niche →
      </a>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-xs text-cyan-300/80 bg-black/30 border border-white/10 rounded px-2 py-1.5 truncate">
        {url}
      </code>
      <button
        onClick={copy}
        className="text-xs px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 whitespace-nowrap"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-3 py-1.5 rounded bg-white/[0.06] text-white/60 hover:bg-white/[0.1] whitespace-nowrap"
      >
        Open
      </a>
    </div>
  );
}
