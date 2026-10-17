import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
}

export function LocationPicker({ lat, lng, onLocationChange, height = "200px" }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = lat && lng ? [lat, lng] : [0, 0];
    const zoom = lat && lng ? 14 : 2;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, zoom);
    map.attributionControl.setPrefix(false);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    if (lat && lng) {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onLocationChange(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        const marker = L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onLocationChange(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }
      onLocationChange(clickLat, clickLng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when coords change externally (e.g. GPS)
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onLocationChange(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }
    mapRef.current.setView([lat, lng], 14);
  }, [lat, lng, onLocationChange]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border"
      style={{ height }}
    />
  );
}
