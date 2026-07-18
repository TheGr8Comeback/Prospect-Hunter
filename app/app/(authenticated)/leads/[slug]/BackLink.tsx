"use client";

import { useRouter } from "next/navigation";

export default function BackLink() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="hover:text-white/60 transition-colors"
    >
      ← Leads
    </button>
  );
}
