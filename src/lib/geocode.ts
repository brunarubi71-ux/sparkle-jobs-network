interface GeoResult {
  lat: number;
  lng: number;
}

/**
 * Converts a free-text address/city into GPS coordinates using Nominatim
 * (OpenStreetMap — free, no API key required).
 * Returns null if the address cannot be resolved.
 */
export async function geocodeAddress(query: string): Promise<GeoResult | null> {
  if (!query.trim()) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Shinely/1.0 (cleaning jobs marketplace)",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const { lat, lon } = data[0];
    return { lat: parseFloat(lat), lng: parseFloat(lon) };
  } catch {
    return null;
  }
}
