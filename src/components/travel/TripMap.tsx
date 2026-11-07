"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { TripLegMode } from "@/lib/db/types";

export interface MapPoint { lat: number; lon: number; label: string; main?: boolean }
export interface MapLine { from: [number, number]; to: [number, number]; mode: TripLegMode; label: string }

const MODE_COLOR: Record<TripLegMode, string> = {
  train: "#4fc3f7", bus: "#9ccc65", car: "#ffb74d", plane: "#ce93d8", ferry: "#4db6ac", transit: "#90a4ae", bike: "#aed581", other: "#b0bec5",
};

/** Zakřivená čára pro let (ať je odlišená od cesty po zemi). */
function arc(a: [number, number], b: [number, number]): [number, number][] {
  const pts: [number, number][] = [];
  const dx = b[1] - a[1];
  const dy = b[0] - a[0];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const bulge = Math.sin(Math.PI * t) * 0.15;
    pts.push([a[0] + dy * t + dx * bulge, a[1] + dx * t - dy * bulge]);
  }
  return pts;
}

/** Mapa trasy cesty: body (cíl, zastávky) a úseky obarvené podle dopravního prostředku. */
export function TripMap({ points, lines, height = 320 }: { points: MapPoint[]; lines: MapLine[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([points, lines]);
  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true, zoomControl: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);
      const bounds: [number, number][] = [];
      for (const l of lines) {
        const path = l.mode === "plane" ? arc(l.from, l.to) : [l.from, l.to];
        L.polyline(path, { color: MODE_COLOR[l.mode], weight: 4, opacity: 0.9, dashArray: l.mode === "plane" || l.mode === "ferry" ? "8 8" : undefined }).bindTooltip(l.label).addTo(map);
        for (const p of [l.from, l.to]) {
          L.circleMarker(p, { radius: 5, color: "#1b1407", weight: 2, fillColor: MODE_COLOR[l.mode], fillOpacity: 1 }).addTo(map);
          bounds.push(p);
        }
      }
      for (const p of points) {
        L.circleMarker([p.lat, p.lon], { radius: p.main ? 9 : 7, color: "#1b1407", weight: 2, fillColor: "#d4b483", fillOpacity: 1 }).bindTooltip(p.label, { permanent: Boolean(p.main), direction: "top", offset: [0, -8] }).addTo(map);
        bounds.push([p.lat, p.lon]);
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
      else if (bounds.length === 1) map.setView(bounds[0], 9);
      else map.setView([49.8, 15.5], 5);
    })();
    return () => { cancelled = true; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div ref={el} style={{ height }} className="relative z-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]" role="img" aria-label="Mapa trasy" />;
}

