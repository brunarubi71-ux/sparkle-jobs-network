// Lightweight chat-message translator backed by MyMemory's free public API
// (https://mymemory.translated.net/doc/spec.php). No API key required, but the
// shared per-IP daily word quota is a few thousand words — translations are
// cached in localStorage so each unique (text, src, tgt) tuple costs only
// one API call across the user's session.

import type { Language } from "@/i18n/translations";

const CACHE_PREFIX = "shinely_tx_v1:";
const ENDPOINT = "https://api.mymemory.translated.net/get";

// MyMemory expects ISO 639-1 codes (en, pt, es). Our app uses these already,
// but pt sometimes needs to be pt-BR for Brazilian Portuguese to disambiguate
// from Portugal Portuguese.
const TO_API_LANG: Record<Language, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
};

const cacheKey = (src: Language, tgt: Language, text: string) =>
  `${CACHE_PREFIX}${src}>${tgt}:${text}`;

const readCache = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeCache = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota exceeded — ignore. Cache is best-effort.
  }
};

export async function translateText(
  text: string,
  src: Language,
  tgt: Language
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || src === tgt) return text;

  const key = cacheKey(src, tgt, trimmed);
  const cached = readCache(key);
  if (cached) return cached;

  // MyMemory's GET endpoint caps at ~500 chars; chunk longer messages by line.
  if (trimmed.length > 480) {
    const lines = trimmed.split(/\n+/);
    const out: string[] = [];
    for (const line of lines) {
      out.push(line.trim() ? await translateText(line, src, tgt) : "");
    }
    const joined = out.join("\n");
    writeCache(key, joined);
    return joined;
  }

  const params = new URLSearchParams({
    q: trimmed,
    langpair: `${TO_API_LANG[src]}|${TO_API_LANG[tgt]}`,
    de: "noreply@shinelyapp.com", // identifying email increases the daily quota
  });

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, { method: "GET" });
  if (!res.ok) throw new Error(`Translate request failed: ${res.status}`);
  const data = await res.json();

  const translated = (data?.responseData?.translatedText as string | undefined) ?? "";
  if (!translated) throw new Error("Empty translation response");

  writeCache(key, translated);
  return translated;
}

export const LANGUAGE_FLAGS: Record<Language, string> = {
  en: "🇺🇸",
  pt: "🇧🇷",
  es: "🇪🇸",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
};

export function normalizeLanguage(value: unknown): Language {
  if (value === "pt" || value === "es" || value === "en") return value;
  return "en";
}
