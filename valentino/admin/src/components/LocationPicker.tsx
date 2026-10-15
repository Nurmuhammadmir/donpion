import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createGeolocationDot } from "@/lib/geolocationDot";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";
// Tashkent city center — default map view when a branch has no location yet.
const DEFAULT_CENTER: [number, number] = [69.2401, 41.2995];

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

// Click-to-place marker for setting a branch's map location in the admin
// form — same Mapbox map the storefront uses, just draggable/clickable
// instead of reverse-geocoding to an address string.
export default function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const startCenter: [number, number] = lat && lng ? [lng, lat] : DEFAULT_CENTER;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: startCenter,
      zoom: lat && lng ? 15 : 11,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    map.scrollZoom.setWheelZoomRate(1 / 300);
    map.scrollZoom.setZoomRate(1 / 70);

    const marker = new mapboxgl.Marker({ color: "#F37021", draggable: true }).setLngLat(startCenter).addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const pos = marker.getLngLat();
      onChangeRef.current(pos.lat, pos.lng);
    });

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      onChangeRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    // Shows the admin's own position so they can judge distance/direction
    // to the branch they're placing — silently does nothing if location
    // access is denied or unavailable. getCurrentPosition is async and can
    // resolve after the component (and the map) is already gone —
    // `cancelled` guards against calling .addTo() on a torn-down map.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the marker in sync if lat/lng are set from outside (e.g. editing
  // an existing branch after the map has already mounted).
  useEffect(() => {
    if (lat && lng && markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      mapRef.current?.setCenter([lng, lat]);
    }
  }, [lat, lng]);

  if (!MAPBOX_TOKEN) {
    return <p className="text-sm text-hermes-600">Карта временно недоступна — не задан VITE_MAPBOX_TOKEN.</p>;
  }

  return <div ref={mapContainer} className="h-64 w-full rounded-lg border border-hairline" />;
}
