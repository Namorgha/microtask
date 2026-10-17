import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

/** Small read-only map showing where a task is. */
export function TaskLocationMap({ lat, lng, height = 200 }: { lat: number; lng: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    }).setView([lat, lng], 15);
    map.attributionControl.setPrefix(false);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);
    L.marker([lat, lng], { icon: pinIcon, interactive: false, keyboard: false }).addTo(map);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      map.remove();
    };
  }, [lat, lng]);

  return <div ref={ref} className="w-full" style={{ height }} aria-label="Task location map" role="img" />;
}
