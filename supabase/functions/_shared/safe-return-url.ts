// Validates a client-supplied return URL against an allowlist of trusted origins
// to prevent open-redirect attacks after Stripe checkout / Connect flows.
const ALLOWED_ORIGINS = [
  "https://shinelyapp.com",
  "https://www.shinelyapp.com",
  "https://shinelyapp.lovable.app",
];

const ALLOWED_HOST_SUFFIXES = [
  ".lovable.app",
  ".lovableproject.com",
];

export function safeReturnUrl(
  candidate: unknown,
  requestOrigin: string | null,
  fallbackPath: string,
): string {
  const fallback = `${requestOrigin && isAllowedOrigin(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]}${fallbackPath}`;
  if (typeof candidate !== "string" || candidate.length === 0) return fallback;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
    if (isAllowedOrigin(u.origin)) return candidate;
    return fallback;
  } catch {
    return fallback;
  }
}

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    return ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}
