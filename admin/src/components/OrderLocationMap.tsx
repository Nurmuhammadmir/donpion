import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { googleMapsDirectionsUrl, yandexMapsDirectionsUrl } from "@/lib/directions";
import { createGeolocationDot } from "@/lib/geolocationDot";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

// Shown in an order's expanded detail row — the pin the customer dropped
// on the checkout map, plus a choice of where to open turn-by-turn
// directions from.
export default function OrderLocationMap({ lat, lng }: { lat: number; lng: number }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: 15,
      interactive: false,
    });
    new mapboxgl.Marker({ color: "#F37021" }).setLngLat([lng, lat]).addTo(map);
    mapRef.current = map;

    // Shows the admin's own position alongside the customer's pin so they
    // can judge distance at a glance — silently does nothing if location
    // access is denied or unavailable. getCurrentPosition is async and can
    // resolve after this effect's own cleanup already tore the map down
    // (e.g. lat/lng changed because a different order was expanded) —
    // `cancelled` guards against calling .addTo() on that removed map.
    let cancelled = false;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        new mapboxgl.Marker({ element: createGeolocationDot() })
          .setLngLat([pos.coords.longitude, pos.coords.latitude])
          .addTo(map);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  if (!MAPBOX_TOKEN) return null;

  return (
    <div>
      <div ref={mapContainer} className="h-40 w-full rounded-lg border border-hairline" />
      <div className="mt-2 flex flex-wrap gap-3">
        <a
          href={googleMapsDirectionsUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-sapphire-600 hover:underline"
        >
          Маршрут в Google Картах
        </a>
        <a
          href={yandexMapsDirectionsUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-sapphire-600 hover:underline"
        >
          Маршрут в Яндекс Картах
        </a>
      </div>
    </div>
  );
}
