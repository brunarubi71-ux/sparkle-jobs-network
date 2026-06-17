import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, LocateFixed } from "lucide-react";

interface Suggestion {
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    road?: string;
    house_number?: string;
    postcode?: string;
  };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: "city" | "address";
  showMyLocation?: boolean;
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function formatSuggestion(s: Suggestion, type: "city" | "address"): string {
  if (type === "city") {
    const a = s.address;
    const city = a?.city || a?.town || a?.village || "";
    const state = a?.state || "";
    const country = a?.country || "";
    return [city, state, country].filter(Boolean).join(", ");
  }
  return s.display_name;
}

export default function LocationAutocomplete({ value, onChange, placeholder, className, type = "address", showMyLocation = false }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) { setSuggestions([]); setOpen(false); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          format: "json",
          limit: "6",
          addressdetails: "1",
          "accept-language": "pt,en",
          ...(type === "city" ? { featuretype: "city" } : {}),
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { "Accept-Language": "pt,en" },
        });
        const data: Suggestion[] = await res.json();
        const unique = Array.from(
          new Map(data.map(s => [formatSuggestion(s, type), s])).values()
        ).filter(s => formatSuggestion(s, type).trim().length > 0);
        setSuggestions(unique);
        setOpen(unique.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350),
    [type]
  );

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    fetchSuggestions(v);
  };

  const handleSelect = (s: Suggestion) => {
    onChange(formatSuggestion(s, type));
    setSuggestions([]);
    setOpen(false);
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=pt,en`
          );
          const data = await res.json();
          const a = data.address || {};
          if (type === "city") {
            const city = a.city || a.town || a.village || a.municipality || "";
            const state = a.state || "";
            onChange([city, state].filter(Boolean).join(", "));
          } else {
            const road = a.road || "";
            const number = a.house_number || "";
            const city = a.city || a.town || a.village || "";
            onChange([number, road, city].filter(Boolean).join(", "));
          }
        } catch {}
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center gap-2">
        <input
          value={value}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`${className} ${showMyLocation ? "pr-10" : ""}`}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        {(loading || locating) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {showMyLocation && !loading && !locating && (
          <button
            type="button"
            onClick={handleMyLocation}
            title="Usar minha localização"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 transition-colors"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => {
            const label = formatSuggestion(s, type);
            return (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors border-b border-border/50 last:border-0"
              >
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
