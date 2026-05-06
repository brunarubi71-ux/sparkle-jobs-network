// ZIP / CEP -> city/state/lat/long lookup. Used by PostJob to auto-fill the
// address fields once the user types a postal code. Supports US ZIP (5 digits
// or 5+4 with dash) and Brazilian CEP (8 digits or 5+3 with dash).
//
// US lookups use Zippopotam.us which returns lat/long directly.
// Brazilian lookups use ViaCEP (street-level address) and then call
// Zippopotam.us with the leading 5 digits to get coarse lat/long.
//
// Both APIs are free and require no API key. We cache successful lookups in
// localStorage so re-typing the same code is instant and doesn't re-hit the
// network.

export type ZipCountry = "us" | "br";

export interface ZipLookupResult {
  country: ZipCountry;
  zip: string;          // normalized form (e.g. "90210" or "01310-100")
  city: string;
  state: string;        // 2-letter state for US, 2-letter UF for BR
  latitude: number | null;
  longitude: number | null;
  street?: string;       // BR only
  neighborhood?: string; // BR only
}

const CACHE_PREFIX = "shinely_zip_v1:";

const readCache = (key: string): ZipLookupResult | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ZipLookupResult) : null;
  } catch {
    return null;
  }
};

const writeCache = (key: string, value: ZipLookupResult) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded — ignore. Cache is best-effort.
  }
};

const stripNonDigits = (s: string) => s.replace(/\D/g, "");

export function detectZipCountry(input: string): ZipCountry | null {
  const digits = stripNonDigits(input);
  if (digits.length === 5 || digits.length === 9) return "us";
  if (digits.length === 8) return "br";
  return null;
}

async function lookupUS(digits: string): Promise<ZipLookupResult | null> {
  const fiveDigit = digits.slice(0, 5);
  const res = await fetch(`https://api.zippopotam.us/us/${fiveDigit}`);
  if (!res.ok) return null;
  const data = await res.json();
  const place = data?.places?.[0];
  if (!place) return null;
  return {
    country: "us",
    zip: digits.length === 9 ? `${fiveDigit}-${digits.slice(5)}` : fiveDigit,
    city: place["place name"] ?? "",
    state: place["state abbreviation"] ?? "",
    latitude: place.latitude ? Number(place.latitude) : null,
    longitude: place.longitude ? Number(place.longitude) : null,
  };
}

async function lookupBR(digits: string): Promise<ZipLookupResult | null> {
  // ViaCEP gives the street-level address but no lat/long.
  const viaRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!viaRes.ok) return null;
  const v = await viaRes.json();
  if (v?.erro) return null;

  // Approximate lat/long via Zippopotam (5-digit prefix).
  let latitude: number | null = null;
  let longitude: number | null = null;
  try {
    const zp = await fetch(`https://api.zippopotam.us/br/${digits.slice(0, 5)}`);
    if (zp.ok) {
      const zd = await zp.json();
      const p = zd?.places?.[0];
      if (p) {
        latitude = p.latitude ? Number(p.latitude) : null;
        longitude = p.longitude ? Number(p.longitude) : null;
      }
    }
  } catch {
    // ignore — lat/long fallback is best-effort
  }

  return {
    country: "br",
    zip: `${digits.slice(0, 5)}-${digits.slice(5)}`,
    city: v.localidade ?? "",
    state: v.uf ?? "",
    latitude,
    longitude,
    street: v.logradouro ?? undefined,
    neighborhood: v.bairro ?? undefined,
  };
}

export async function lookupZip(input: string): Promise<ZipLookupResult | null> {
  const digits = stripNonDigits(input);
  const country = detectZipCountry(digits);
  if (!country) return null;

  const cacheKey = `${CACHE_PREFIX}${country}:${digits}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const result = country === "us" ? await lookupUS(digits) : await lookupBR(digits);
    if (result) writeCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[zipLookup]", err);
    return null;
  }
}
