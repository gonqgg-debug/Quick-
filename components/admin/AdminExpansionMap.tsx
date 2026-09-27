"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { ExpansionEtapa, ExpansionSitio } from "@/lib/expansion-shared";

const PIN: Record<ExpansionEtapa, string> = {
  identificado: "#1F82C5",
  contacto_encontrado: "#1F82C5",
  contactado: "#123B7A",
  presentacion_enviada: "#7EB341",
  respondio: "#7EB341",
  conversacion: "#3F6212",
  oportunidad: "#F79521",
  negociacion: "#C2410C",
  pausa: "#6B7280",
  descartado: "#9CA3AF",
};

type AdminExpansionMapProps = {
  sitios: ExpansionSitio[];
  focusId?: string | null;
  onSelect: (id: string) => void;
};

export function AdminExpansionMap({ sitios, focusId = null, onSelect }: AdminExpansionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const sitiosRef = useRef(sitios);
  sitiosRef.current = sitios;
  const signature = sitios
    .filter((sitio) => sitio.lat != null && sitio.lng != null)
    .map((sitio) => `${sitio.id}:${sitio.lat}:${sitio.lng}:${sitio.etapa}:${sitio.etapaLabel}:${sitio.nombre}`)
    .join("|");

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
      map = L.map(el, { scrollWheelZoom: true, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const ubicados = sitiosRef.current.filter((sitio) => sitio.lat != null && sitio.lng != null);
      const bounds: import("leaflet").LatLngTuple[] = [];
      for (const sitio of ubicados) {
        if (sitio.lat == null || sitio.lng == null) {
          continue;
        }
        bounds.push([sitio.lat, sitio.lng]);
        const icon = L.divIcon({
          className: "expansion-crm-pin",
          html: `<span style="display:block;width:18px;height:18px;border-radius:999px;background:${PIN[sitio.etapa]};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([sitio.lat, sitio.lng], { icon }).addTo(map);
        marker.bindTooltip(`${sitio.nombre} · ${sitio.etapaLabel}`, { direction: "top", offset: [0, -10] });
        marker.on("click", () => onSelectRef.current(sitio.id));
      }

      const focused = ubicados.find((sitio) => sitio.id === focusId && sitio.lat != null && sitio.lng != null);
      if (focused?.lat != null && focused.lng != null) {
        map.setView([focused.lat, focused.lng], 15);
      } else if (bounds.length === 0) {
        map.setView([18.62, -68.42], 11);
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else {
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14 });
      }
      window.setTimeout(() => map?.invalidateSize(), 200);
    }

    void setup();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [signature, focusId]);

  return (
    <div className="h-[440px] overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#E8EEF2]">
      <style>{".expansion-crm-pin{background:transparent !important;border:0 !important;}"}</style>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
