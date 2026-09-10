"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
// Tashkent city center — where the map opens before the visitor picks a
// more precise delivery spot.
const DEFAULT_CENTER: [number, number] = [69.2401, 41.2995];

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface AddressMapPickerProps {
  value: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
}

function createGeolocationDot(): HTMLDivElement {
  // A small "you are here" dot, distinct from the orange delivery pin —
  // purely informational, not draggable, just for orientation.
  const el = document.createElement("div");
  el.style.width = "14px";
  el.style.height = "14px";
  el.style.borderRadius = "50%";
  el.style.background = "#4285F4";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 0 0 4px rgba(66,133,244,0.35)";
  return el;
}

// Lets the customer drop a pin for the delivery address instead of typing
// one — opens centered on Tashkent, a draggable marker reverse-geocodes to
// a readable address via Mapbox's Geocoding API as it's moved.
export default function AddressMapPicker({ value, onChange }: AddressMapPickerProps) {
  const locale = useLocale();
  const t = useTranslations("AddressMapPicker");
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [address, setAddress] = useState(value?.address ?? "");
  const [loadingAddress, setLoadingAddress] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    setLoadingAddress(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=${locale}`
      );
      const data = await res.json();
      const place = data.features?.[0]?.place_name as string | undefined;
      const resolvedAddress = place || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddress(resolvedAddress);
      onChange({ lat, lng, address: resolvedAddress });
    } catch {
      const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddress(fallback);
      onChange({ lat, lng, address: fallback });
    } finally {
      setLoadingAddress(false);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const startCenter: [number, number] = value ? [value.lng, value.lat] : DEFAULT_CENTER;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: startCenter,
      zoom: value ? 15 : 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    // A bit snappier than Mapbox's defaults (1/450 wheel, 1/100 trackpad) —
    // felt sluggish at the stock rate.
    map.scrollZoom.setWheelZoomRate(1 / 300);
    map.scrollZoom.setZoomRate(1 / 70);

    const marker = new mapboxgl.Marker({ color: "#F37021", draggable: true })
      .setLngLat(startCenter)
      .addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const { lat, lng } = marker.getLngLat();
      reverseGeocode(lat, lng);
    });

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      reverseGeocode(e.lngLat.lat, e.lngLat.lng);
    });

    if (!value) {
      // No saved pin yet — geocode the default center so the form starts
      // with a real address string instead of raw coordinates.
      reverseGeocode(DEFAULT_CENTER[1], DEFAULT_CENTER[0]);
    }

    // Shows the visitor's own position as a small blue dot so they can see
    // where they are relative to the delivery pin — silently does nothing
    // if location access is denied or unavailable. getCurrentPosition is
    // async and can resolve well after the component (and the map) is
    // gone (e.g. the visitor already navigated away while the permission
    // prompt was up) — `cancelled` guards against calling .addTo() on a
    // map that .remove() has already torn down.
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

  if (!MAPBOX_TOKEN) {
    return <p className="text-sm text-hermes-600">{t("missingToken")}</p>;
  }

  return (
    <div>
      <div ref={mapContainer} className="h-64 w-full border border-hairline" />
      <p className="mt-2 text-xs leading-relaxed text-graphite">
        {loadingAddress ? t("locating") : address || t("tapToPick")}
      </p>
    </div>
  );
}
