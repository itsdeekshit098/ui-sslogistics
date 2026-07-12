import { logger } from "@/lib/logger";

/**
 * Server-only wrapper around LocationIQ's free-tier autocomplete endpoint.
 * Used to give live address suggestions on free-text location inputs
 * (trip bookings, external trips) — suggestions are a convenience only,
 * the underlying fields stay plain text, so a failed/missing lookup must
 * never throw or block the caller.
 */

export interface GeocodeSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

export async function searchLocations(query: string): Promise<GeocodeSuggestion[]> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;
  if (!apiKey) {
    logger.warn("LOCATIONIQ_API_KEY not set — skipping location suggestions");
    return [];
  }

  try {
    const url = `https://us1.locationiq.com/v1/autocomplete?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&limit=5&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn("LocationIQ autocomplete request failed", { status: res.status });
      return [];
    }

    const results = await res.json();
    if (!Array.isArray(results)) return [];

    return results
      .map((r): GeocodeSuggestion | null => {
        const lat = Number(r?.lat);
        const lon = Number(r?.lon);
        if (!r?.display_name || Number.isNaN(lat) || Number.isNaN(lon)) return null;
        return { label: r.display_name, latitude: lat, longitude: lon };
      })
      .filter((s): s is GeocodeSuggestion => s !== null);
  } catch (err) {
    logger.error("Location suggestion lookup failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
