"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Branch } from "@/types";
import { googleMapsDirectionsUrl, yandexMapsDirectionsUrl } from "@/lib/directions";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Its own section at the bottom of the footer, below the four columns —
// centered at 60% width on desktop (full width on mobile/tablet) rather
// than either spanning edge-to-edge or being squeezed into a narrow
// column. One pin per branch (added by admins in the Филиалы panel);
// clicking a pin opens a small card with a Google/Yandex directions choice.
export default function BranchesMap({ branches }: { branches: Branch[] }) {
  const t = useTranslations("BranchesMap");
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN || branches.length === 0) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [branches[0].lng, branches[0].lat],
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    map.scrollZoom.setWheelZoomRate(1 / 300);
    map.scrollZoom.setZoomRate(1 / 70);

    branches.forEach((branch) => {
      const marker = new mapboxgl.Marker({ color: "#F37021" }).setLngLat([branch.lng, branch.lat]).addTo(map);
      const el = marker.getElement();
      el.style.cursor = "pointer";
      el.addEventListener("click", () => setActiveBranch(branch));
    });

    if (branches.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      branches.forEach((b) => bounds.extend([b.lng, b.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  if (!MAPBOX_TOKEN || branches.length === 0) return null;

  return (
    <div className="border-t border-hairline pt-10">
      <h3 className="eyebrow mb-4">{t("heading")}</h3>
      <div ref={mapContainer} className="h-56 w-full border border-hairline" />

      {activeBranch && (
        <div className="page-transition mt-4 border border-hairline p-4 text-sm">
          <p className="font-display text-base text-ink">{activeBranch.name}</p>
          <p className="mt-1 text-graphite">{activeBranch.address}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <a
              href={googleMapsDirectionsUrl(activeBranch.lat, activeBranch.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4"
            >
              {t("openGoogle")}
            </a>
            <a
              href={yandexMapsDirectionsUrl(activeBranch.lat, activeBranch.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4"
            >
              {t("openYandex")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
