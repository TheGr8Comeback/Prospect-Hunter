"use client";

import { useEffect, useState } from "react";

export default function WorkerStatus() {
  const [status, setStatus] = useState<{ online: boolean; lastPing: string | null; agoMs: number } | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/worker-status");
        const data = await res.json();
        setStatus(data);
      } catch {
        setStatus({ online: false, lastPing: null, agoMs: 0 });
      }
    }

    check();
    const interval = setInterval(check, 60_000); // re-check every minute
    return () => clearInterval(interval);
  }, []);

  // Hide if online, or if no heartbeat has ever been recorded (new workspace without worker)
  if (!status || status.online || !status.lastPing) return null;

  const ago = status.lastPing
    ? formatAgo(status.agoMs)
    : "jamais";

  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2 flex items-center gap-2">
      <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
      <span>Worker offline — dernier signal : {ago}</span>
    </div>
  );
}

function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}
