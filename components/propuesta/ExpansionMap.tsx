"use client";

import { useEffect, useRef } from "react";
import { EXPANSION_SITES, MAP_LANDMARKS, siteLogoSrc, type ExpansionSite } from "@/lib/expansion-sites";
import "leaflet/dist/leaflet.css";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pinHtml(site: ExpansionSite): string {
  const brandClass = site.brand === "pharmaquick" ? " is-pharma" : "";
  const statusClass = site.status === "projected" ? " is-projected" : "";
  const offsetClass = site.pinOffset === "left" ? " is-left" : site.pinOffset === "right" ? " is-right" : "";
  const logo = siteLogoSrc(site.brand);
  const label = site.opening ? "Nov 2026" : site.status === "open" ? "Abierta" : "Próx.";
  return `
    <div class="propuesta-pin-stack${offsetClass}">
      <div class="propuesta-pin-logo${brandClass}">
        <img src="${logo}" alt="${escapeHtml(site.brand === "pharmaquick" ? "PharmaQuick!" : "Quick!")}" />
      </div>
      <div class="propuesta-pin-name">${escapeHtml(site.shortName)} · ${escapeHtml(label)}</div>
      <span class="propuesta-pin-point${brandClass}${statusClass}"></span>
    </div>
  `;
}

export function ExpansionMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    let cancelled = false;

    function refreshMap() {
      mapRef.current?.invalidateSize();
    }

    async function setup() {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !el) {
        return;
      }

      const map = L.map(el, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const bounds: import("leaflet").LatLngTuple[] = [];
      for (const landmark of MAP_LANDMARKS) {
        bounds.push([landmark.lat, landmark.lng]);
        const icon = L.divIcon({
          className: "propuesta-pin",
          html: `<div class="propuesta-landmark">${escapeHtml(landmark.name)}</div>`,
          iconSize: [88, 22],
          iconAnchor: [44, 11],
        });
        L.marker([landmark.lat, landmark.lng], { icon, zIndexOffset: -50 }).addTo(map);
      }
      for (const site of EXPANSION_SITES) {
        bounds.push([site.lat, site.lng]);
        const icon = L.divIcon({
          className: "propuesta-pin",
          html: pinHtml(site),
          iconSize: site.brand === "pharmaquick" ? [96, 64] : [120, 70],
          iconAnchor: site.brand === "pharmaquick" ? [48, 64] : [60, 70],
        });
        L.marker([site.lat, site.lng], { icon, zIndexOffset: site.status === "open" ? 200 : 0 }).addTo(map);
      }

      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 12 });
      requestAnimationFrame(refreshMap);
      window.setTimeout(refreshMap, 250);
    }

    void setup();
    window.addEventListener("beforeprint", refreshMap);
    window.addEventListener("propuesta:prepare-print", refreshMap);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeprint", refreshMap);
      window.removeEventListener("propuesta:prepare-print", refreshMap);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="propuesta-map" data-map="expansion" />;
}
