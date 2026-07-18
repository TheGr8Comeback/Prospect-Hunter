"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const nav = [
  { href: "/",            label: "Dashboard",   icon: "⚡" },
  { href: "/leads",       label: "Leads",       icon: "🎯" },
  { href: "/engagement",  label: "Engagement",  icon: "🔥" },
  { href: "/sites",       label: "Sites",       icon: "🌐" },
  { href: "/map",         label: "Map",         icon: "🗺️"  },
  { href: "/jobs",        label: "Jobs",        icon: "⚙️"  },
  { href: "/monitoring",  label: "Monitoring",  icon: "📊" },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-52 shrink-0 border-r border-white/[0.06] flex flex-col py-6 px-3 gap-1 h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-3 mb-6">
        <p className="text-[11px] font-mono tracking-widest uppercase text-white/25">Prospect</p>
        <p className="text-lg font-semibold tracking-tight">OS</p>
      </div>

      {/* Nav */}
      {nav.map(({ href, label, icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
            }`}
          >
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
      >
        <span className="text-base">🚪</span>
        Logout
      </button>
    </aside>
  );
}
