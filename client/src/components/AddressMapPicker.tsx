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
  // A small round "you are here" dot, distinct from the orange delivery
  // pin — purely informational, never draggable, and never the thing that
  // sets the delivery address. Where someone is standing and where they
  // want flowers delivered are two different things.
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
// one — opens centered on Tashkent (or a previously saved pin), a
// draggable orange marker reverse-geocodes to a readable address via
// Mapbox's Geocoding API as it's clicked or dragged. Geolocation only ever
// drives a separate round blue dot plus where the camera looks — it never
// moves the delivery pin itself.
export default function AddressMapPicker({ value, onChange }: AddressMapPickerProps) {
  const locale = useLocale();
  const t = useTranslations("AddressMapPicker");
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const geoMarkerRef = useRef<mapboxgl.Marker | null>(null);
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

  // Shows (or moves) the round "you are here" dot and points the camera at
  // it — used both for the silent first-load attempt and the manual
  // "Определить моё местоположение" button. Never touches the delivery pin.
  const showClientLocation = (shouldFly: boolean) => {
    if (!mapRef.current) return;
    setLocatingMe(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLocatingMe(false);
        if (!mapRef.current) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        if (geoMarkerRef.current) {
          geoMarkerRef.current.setLngLat([lng, lat]);
        } else {
          geoMarkerRef.current = new mapboxgl.Marker({ element: createGeolocationDot() })
            .setLngLat([lng, lat])
            .addTo(mapRef.current);
        }
        if (shouldFly) mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
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
      const { lat, lng } = marker.getLngLat();
      reverseGeocode(lat, lng);
    });

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      reverseGeocode(e.lngLat.lat, e.lngLat.lng);
    });

    if (!value) {
      // No saved pin yet — reverse-geocode the default Tashkent center so
      // the form starts with a real address string instead of raw coords.
      reverseGeocode(DEFAULT_CENTER[1], DEFAULT_CENTER[0]);
    }

    // Silently shows the "you are here" dot if permission is already
    // granted — informational only. Only flies the camera there on first
    // load if the visitor hasn't already got a saved pin to look at.
    showClientLocation(!hadInitialValueRef.current);

    // Chrome/Edge/Android report permission changes live — if the visitor
    // had dismissed the prompt above and grants access a moment later (e.g.
    // via the padlock menu) instead of reloading, this catches it. Safari
    // has no "geolocation" entry in the Permissions API — the manual
    // button below the map covers that case.
    let permissionStatus: PermissionStatus | null = null;
    const watchPermission = async () => {
      try {
        permissionStatus = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        if (permissionStatus) {
          permissionStatus.onchange = () => {
            if (permissionStatus?.state === "granted") showClientLocation(!hadInitialValueRef.current);
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
          onClick={() => showClientLocation(true)}
          disabled={locatingMe}
          className="flex-shrink-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-2 transition-colors hover:text-hermes-600 disabled:opacity-50"
        >
          {locatingMe ? t("locating") : t("locateMe")}
        </button>
      </div>
    </div>
  );
}
