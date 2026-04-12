type Coordinates = [number, number];

/** Haversine distance in miles */
export function getDistanceMiles(from: Coordinates, to: Coordinates): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((to[0] - from[0]) * Math.PI) / 180;
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from[0] * Math.PI) / 180) *
      Math.cos((to[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format distance as "1.2 mi" */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
}

/** Estimate drive time in minutes (avg 25 mph city driving, 1.4x straight-line factor) */
export function estimateEtaMinutes(miles: number): number {
  const adjustedMiles = miles * 1.4;
  return Math.max(1, Math.round((adjustedMiles / 25) * 60));
}

/** Format ETA as "12 min" */
export function formatEta(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes >= 60) return `${Math.round(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} min`;
}
