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
// a readable address via Mapbox's Geocoding API as it's moved. If the
// visitor hasn't picked a spot yet, the pin starts at their own real
// position instead of the generic Tashkent center whenever geolocation is
// available — and keeps trying if permission is granted a moment late
// (the browser prompt, or the visitor flipping it on in site settings)
// rather than requiring a page refresh to notice.
export default function AddressMapPicker({ value, onChange }: AddressMapPickerProps) {
  const locale = useLocale();
  const t = useTranslations("AddressMapPicker");
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const userMovedPinRef = useRef(false);
  const hadInitialValueRef = useRef(!!value);
  const [address, setAddress] = useState(value?.address ?? "");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locatingMe, setLocatingMe] = useState(false);

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

  // Moves the pin (and the map) to the visitor's real position right now —
  // used both for the silent first-load attempt and the manual "Определить
  // моё местоположение" link below the map.
  const centerOnClient = () => {
    if (!mapRef.current || !markerRef.current) return;
    setLocatingMe(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLocatingMe(false);
        if (!mapRef.current || !markerRef.current) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        markerRef.current.setLngLat([lng, lat]);
        mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
        reverseGeocode(lat, lng);
      },
      () => setLocatingMe(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
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
      userMovedPinRef.current = true;
      const { lat, lng } = marker.getLngLat();
      reverseGeocode(lat, lng);
    });

    map.on("click", (e) => {
      userMovedPinRef.current = true;
      marker.setLngLat(e.lngLat);
      reverseGeocode(e.lngLat.lat, e.lngLat.lng);
    });

    if (value) {
      // A saved pin already exists (editing a previous address) — just show
      // a small "you are here" dot for orientation, never move the pin.
      let cancelled = false;
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          if (cancelled || !mapRef.current) return;
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
    }

    // No saved pin yet — the delivery pin's starting point should be where
    // the visitor is actually standing, not a generic Tashkent center.
    // Silently asks for permission (same prompt the old "you are here" dot
    // used) and falls back to the Tashkent-center reverse geocode if denied,
    // unavailable, or the visitor already dragged/tapped the pin themselves
    // while the request was pending.
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        if (!mapRef.current || userMovedPinRef.current) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        marker.setLngLat([lng, lat]);
        map.flyTo({ center: [lng, lat], zoom: 15, duration: 600 });
        reverseGeocode(lat, lng);
      },
      () => {
        if (!userMovedPinRef.current) reverseGeocode(DEFAULT_CENTER[1], DEFAULT_CENTER[0]);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    // Chrome/Edge/Android report permission changes live — if the visitor
    // had dismissed the prompt above and grants access a moment later (e.g.
    // via the padlock menu) instead of reloading, this catches it and
    // re-centers immediately. Safari has no "geolocation" entry in the
    // Permissions API — the manual link below the map covers that case.
    let permissionStatus: PermissionStatus | null = null;
    const watchPermission = async () => {
      try {
        permissionStatus = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        if (permissionStatus) {
          permissionStatus.onchange = () => {
            if (permissionStatus?.state === "granted" && !hadInitialValueRef.current && !userMovedPinRef.current) {
              centerOnClient();
            }
          };
        }
      } catch {
        // Permissions API (or the "geolocation" name) unsupported — ignore.
      }
    };
    watchPermission();

    return () => {
      if (permissionStatus) permissionStatus.onchange = null;
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
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed text-graphite">{loadingAddress ? t("locating") : address || t("tapToPick")}</p>
        <button
          type="button"
          onClick={centerOnClient}
          disabled={locatingMe}
          className="flex-shrink-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-2 transition-colors hover:text-hermes-600 disabled:opacity-50"
        >
          {locatingMe ? t("locating") : t("locateMe")}
        </button>
      </div>
    </div>
  );
}
