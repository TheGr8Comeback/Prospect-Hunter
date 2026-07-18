"use client";

import { useEffect, useRef, useState } from "react";

function warmColor(warmScore: number): string {
  if (warmScore >= 70) return "#34d399";
  if (warmScore >= 40) return "#fbbf24";
  return "#6b7280";
}

export default function LeadsMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    let mapInstance: any;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!containerRef.current) return;

      mapInstance = L.map(containerRef.current).setView([30, 0], 2);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(mapInstance);

      const res = await fetch("/api/leads/geo");
      const geojson = await res.json();
      setCount(geojson.features.length);

      geojson.features.forEach((f: any) => {
        const { coordinates } = f.geometry;
        const p = f.properties;
        const color = warmColor(p.warm_score);

        const marker = L.circleMarker([coordinates[1], coordinates[0]], {
          radius: 8,
          fillColor: color,
          color: "#0a0a0a",
          weight: 2,
          fillOpacity: 0.85,
        }).addTo(mapInstance);

        marker.bindPopup(
          `<div style="font-family:monospace;font-size:12px;min-width:160px">
            <div style="font-weight:600;margin-bottom:4px">${p.name}</div>
            <div style="color:#888;font-size:10px;margin-bottom:6px">${p.category ?? ""} · ${p.city ?? ""}</div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="color:${color};font-weight:600">${p.warm_score}/100</span>
              ${p.email ? '<span style="color:#34d399;font-size:10px">✉ email</span>' : ""}
              ${p.has_website ? '<span style="color:#a855f7;font-size:10px">⌂ site</span>' : ""}
            </div>
          </div>`,
          { className: "lead-popup" }
        );

        marker.on("click", () => {
          window.location.href = `/leads/${p.slug}`;
        });
      });

      // Keep the world overview — user zooms in manually
    })();

    return () => {
      if (mapInstance) mapInstance.remove();
    };
  }, []);

  return (
    <div className="relative w-full" style={{ height: "100vh" }}>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-4 left-4 z-[1000] bg-[#1a1a1a]/90 backdrop-blur border border-white/[0.08] rounded-lg px-4 py-2 flex items-center gap-3">
        <span className="text-sm font-medium">{count} leads</span>
        <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> ≥70
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-1" /> ≥40
          <span className="inline-block w-2 h-2 rounded-full bg-gray-500 ml-1" /> &lt;40
        </div>
      </div>
    </div>
  );
}
