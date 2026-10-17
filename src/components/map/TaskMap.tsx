import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { createRoot, type Root } from "react-dom/client";
import { useNavigate } from "react-router-dom";
import { TaskMapPopup } from "./TaskMapPopup";

const CATEGORY_COLORS: Record<string, string> = {
  delivery: "#f97316",
  cleaning: "#06b6d4",
  repair: "#ef4444",
  shopping: "#8b5cf6",
  tech: "#3b82f6",
  tutoring: "#10b981",
  moving: "#f59e0b",
  other: "#6b7280",
};

const BRAND = "hsl(160, 84%, 39%)";
// Shown only when the user has no location and there are no tasks to frame.
const FALLBACK_CENTER: [number, number] = [51.5072, -0.1276];
const FALLBACK_ZOOM = 11;

function createCategoryIcon(category: string) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return L.divIcon({
    className: "custom-task-marker",
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
      background: ${color}; transform: rotate(-45deg);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 2px solid white;
    "><div style="
      width: 10px; height: 10px; background: white; border-radius: 50%;
      transform: rotate(45deg);
    "></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

function zoomForRadius(radiusKm: number) {
  return radiusKm <= 2 ? 14 : radiusKm <= 5 ? 13 : radiusKm <= 10 ? 12 : radiusKm <= 25 ? 11 : 10;
}

const hasCoords = (t: any) => Number.isFinite(Number(t?.lat)) && Number.isFinite(Number(t?.lng));

interface TaskMapProps {
  tasks: any[];
  userLat: number | null;
  userLng: number | null;
  radiusKm: number;
}

export function TaskMap({ tasks, userLat, userLng, radiusKm }: TaskMapProps) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const popupRootsRef = useRef<Root[]>([]);
  const framedRef = useRef(false);

  const hasUser = userLat !== null && userLng !== null;

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      tap: false, // avoids double-fired clicks on mobile Safari
    } as L.MapOptions).setView(
      hasUser ? [userLat!, userLng!] : FALLBACK_CENTER,
      hasUser ? zoomForRadius(radiusKm) : FALLBACK_ZOOM,
    );

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

    // OpenStreetMap standard tiles: free, no API key. Attribution is required.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (c: any) => {
        const count = c.getChildCount();
        const s = count < 10 ? 36 : count < 50 ? 44 : 52;
        return L.divIcon({
          html: `<div style="
            width: ${s}px; height: ${s}px; border-radius: 50%;
            background: ${BRAND}; color: white; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.25);
            border: 3px solid white;
          ">${count}</div>`,
          className: "custom-cluster-icon",
          iconSize: [s, s],
        });
      },
    });

    map.addLayer(cluster);
    userLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    clusterRef.current = cluster;

    // Keep tiles correct when the container changes size (rotation, view switch, keyboard).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      unmountPopups();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      userLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unmountPopups() {
    const roots = popupRootsRef.current;
    popupRootsRef.current = [];
    // Defer so React isn't unmounting a root mid-render.
    setTimeout(() => roots.forEach((r) => r.unmount()), 0);
  }

  // User location: dot + radius circle, replaced (not stacked) on every change
  useEffect(() => {
    const map = mapRef.current;
    const layer = userLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!hasUser) return;

    L.circle([userLat!, userLng!], {
      radius: radiusKm * 1000,
      color: BRAND,
      fillColor: BRAND,
      fillOpacity: 0.06,
      weight: 2,
      dashArray: "6 4",
      interactive: false,
    }).addTo(layer);

    L.circleMarker([userLat!, userLng!], {
      radius: 8,
      fillColor: BRAND,
      color: "white",
      weight: 3,
      fillOpacity: 1,
    }).addTo(layer).bindTooltip("You are here", { direction: "top" });

    map.setView([userLat!, userLng!], zoomForRadius(radiusKm));
    framedRef.current = true;
  }, [userLat, userLng, radiusKm, hasUser]);

  // Task markers
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    cluster.clearLayers();
    unmountPopups();

    const placed = tasks.filter(hasCoords);
    placed.forEach((task) => {
      const lat = Number(task.lat);
      const lng = Number(task.lng);
      const marker = L.marker([lat, lng], { icon: createCategoryIcon(task.category) });

      const popupContainer = document.createElement("div");
      popupContainer.style.width = "240px";
      popupContainer.style.maxWidth = "100%";
      let root: Root | null = null;

      marker.bindPopup(popupContainer, {
        maxWidth: 260,
        minWidth: 200,
        className: "task-popup",
        closeButton: true,
        autoPanPaddingTopLeft: [16, 16],
        autoPanPaddingBottomRight: [16, 56],
      });

      marker.on("popupopen", () => {
        const distance = hasUser
          ? `${getDistanceKm(userLat!, userLng!, lat, lng).toFixed(1)} km`
          : task.location;
        if (!root) {
          root = createRoot(popupContainer);
          popupRootsRef.current.push(root);
        }
        root.render(
          <TaskMapPopup
            id={task.id}
            title={task.title}
            description={task.description}
            price={Number(task.price)}
            category={task.category}
            distance={distance}
            posterName={task.poster?.full_name || "Anonymous"}
            onOpen={(id) => navigateRef.current(`/tasks/${id}`)}
          />,
        );
        // Popup content renders async; re-measure so it is positioned correctly.
        requestAnimationFrame(() => marker.getPopup()?.update());
      });

      cluster.addLayer(marker);
    });

    // Without a location, frame the tasks instead of showing an empty map.
    if (!hasUser && placed.length) {
      const bounds = L.latLngBounds(placed.map((t) => [Number(t.lat), Number(t.lng)] as [number, number]));
      if (!framedRef.current) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        framedRef.current = true;
      }
    }
  }, [tasks, userLat, userLng, hasUser]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {tasks.length > 0 && !tasks.some(hasCoords) && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[1] mx-auto w-fit rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow">
          These tasks have no map location
        </div>
      )}
    </div>
  );
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
