import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
}

// Leaflet's default marker loads PNGs by relative URL, which breaks after a
// Vite build (the "Mark" broken image). A CSS/HTML pin has no assets to lose.
const pinIcon = L.divIcon({
  className: "custom-task-marker",
  html: `<div style="
    width: 34px; height: 34px; border-radius: 50% 50% 50% 0;
    background: hsl(158, 64%, 38%); transform: rotate(-45deg);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 10px rgba(0,0,0,0.35); border: 3px solid white;
  "><div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const FALLBACK_CENTER: [number, number] = [51.5072, -0.1276];

export function LocationPicker({ lat, lng, onLocationChange, height = "200px" }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onLocationChange);
  onChangeRef.current = onLocationChange;
  // Coordinates this component itself reported, so we don't re-center the map on them.
  const lastEmittedRef = useRef<string | null>(null);

  const emit = (la: number, ln: number) => {
    lastEmittedRef.current = `${la},${ln}`;
    onChangeRef.current(la, ln);
  };

  const placeMarker = (la: number, ln: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([la, ln]);
      return;
    }
    const marker = L.marker([la, ln], { draggable: true, icon: pinIcon, autoPan: true }).addTo(map);
    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      emit(pos.lat, pos.lng);
    });
    markerRef.current = marker;
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const hasCoords = lat !== null && lng !== null;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(hasCoords ? [lat!, lng!] : FALLBACK_CENTER, hasCoords ? 15 : 11);
    map.attributionControl.setPrefix(false);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    mapRef.current = map;
    if (hasCoords) {
      placeMarker(lat!, lng!);
      lastEmittedRef.current = `${lat},${lng}`;
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      placeMarker(e.latlng.lat, e.latlng.lng);
      emit(e.latlng.lat, e.latlng.lng);
    });

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coordinates set from outside (GPS button / auto-detect): move the pin and center on it.
  useEffect(() => {
    if (!mapRef.current || lat === null || lng === null) return;
    if (lastEmittedRef.current === `${lat},${lng}`) return;
    lastEmittedRef.current = `${lat},${lng}`;
    placeMarker(lat, lng);
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      style={{ height }}
    />
  );
}
