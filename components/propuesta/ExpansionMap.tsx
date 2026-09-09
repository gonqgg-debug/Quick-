"use client";

import { useEffect, useRef } from "react";
import { EXPANSION_SITES, siteLogoSrc, type ExpansionSite } from "@/lib/expansion-sites";
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
  const label = site.opening ?? (site.status === "open" ? "Abierta" : "Proyectada");
  return `
    <div class="propuesta-pin-stack${offsetClass}">
      <div class="propuesta-pin-logo${brandClass}">
        <img src="${logo}" alt="${escapeHtml(site.brand === "pharmaquick" ? "PharmaQuick!" : "Quick!")}" />
      </div>
      <div class="propuesta-pin-name">${escapeHtml(site.name)} · ${escapeHtml(label)}</div>
      <span class="propuesta-pin-point${brandClass}${statusClass}"></span>
    </div>
  `;
}

export function ExpansionMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    async function setup() {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !el) {
        return;
      }

      map = L.map(el, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 18,
      }).addTo(map);

      const bounds: import("leaflet").LatLngTuple[] = [];
      for (const site of EXPANSION_SITES) {
        bounds.push([site.lat, site.lng]);
        const icon = L.divIcon({
          className: "propuesta-pin",
          html: pinHtml(site),
          iconSize: [148, 78],
          iconAnchor: [74, 78],
        });
        L.marker([site.lat, site.lng], { icon, zIndexOffset: site.status === "open" ? 200 : 0 }).addTo(map);
      }

      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 12 });
      requestAnimationFrame(() => {
        map?.invalidateSize();
      });
      window.setTimeout(() => map?.invalidateSize(), 250);
    }

    void setup();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return <div ref={containerRef} className="propuesta-map" data-map="expansion" />;
}
