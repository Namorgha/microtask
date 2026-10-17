/**
 * Reverse geocoding via OpenStreetMap Nominatim (free, no API key).
 * Usage policy: max 1 request/second, so callers should debounce.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

type NominatimAddress = Partial<Record<
  | "house_number" | "road" | "pedestrian" | "neighbourhood" | "suburb" | "quarter"
  | "city_district" | "city" | "town" | "village" | "municipality" | "county" | "state" | "country",
  string
>>;

interface NominatimResult {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
}

/** Turns a Nominatim result into a short, human label like "Rue Allal Ben Abdellah, Marshan, Tangier". */
export function formatAddress(r: NominatimResult): string | null {
  const a = r.address ?? {};
  const street = [a.road ?? a.pedestrian, a.house_number].filter(Boolean).join(" ");
  const area = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district;
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state;
  const parts = [street || r.name, area, city].filter((p): p is string => !!p && p.trim().length > 0);
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  if (unique.length) return unique.join(", ").slice(0, 200);
  return r.display_name ? r.display_name.split(",").slice(0, 3).join(",").trim().slice(0, 200) : null;
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    zoom: "18",
    addressdetails: "1",
    "accept-language": navigator.language || "en",
  }).toString();

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimResult & { error?: string };
  if (data.error) return null;
  return formatAddress(data);
}
