import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, Bed, Bath, Clock, Sparkles, Flame, Zap, TrendingUp,
  Navigation, ChevronUp, ChevronDown, Car, AlertTriangle,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, CircleMarker, ZoomControl, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ShimmerCard from "@/components/ShimmerCard";
import PremiumModal from "@/components/PremiumModal";
import JobConfirmationModal from "@/components/JobConfirmationModal";
import BottomNav from "@/components/BottomNav";
import JobFilterChips, { type JobFilter } from "@/components/jobs/JobFilterChips";
import { getDistanceMiles, formatDistance, estimateEtaMinutes, formatEta } from "@/lib/distance";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

type Coordinates = [number, number];
const DEFAULT_CENTER: Coordinates = [34.0522, -118.2437];

interface Job {
  id: string;
  owner_id: string;
  title: string;
  cleaning_type: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  address: string | null;
  city: string | null;
  urgency: string;
  status: string;
  description: string | null;
  created_at: string;
  hired_cleaner_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface JobWithDistance extends Job {
  distanceMiles: number | null;
  etaMinutes: number | null;
}

/* ── tiny map helper ── */
function MapViewportSync({ center }: { center: Coordinates }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [center, map]);
  return null;
}

function FlyToMyLocation({ trigger, location }: { trigger: number; location: Coordinates | null }) {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0 && location) {
      map.flyTo(location, 14, { duration: 1.2 });
    }
  }, [trigger, location, map]);
  return null;
}

function MapResizeSync({ expanded }: { expanded: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 350);
    return () => window.clearTimeout(t);
  }, [expanded, map]);
  return null;
}

/* ── helpers ── */
const getTimeSince = (dateStr: string, t: (k: string) => string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.just_now");
  if (mins < 60) return `${mins}${t("time.minutes_ago")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t("time.hours_ago")}`;
  return `${Math.floor(hrs / 24)}${t("time.days_ago")}`;
};

function getJobLimits(tier: string) {
  switch (tier) {
    case "pro": return { maxJobs: Infinity };
    case "premium": return { maxJobs: 3 };
    default: return { maxJobs: 2 };
  }
}

const getJobPosition = (job: Job, index: number, center: Coordinates): Coordinates => {
  if (typeof job.latitude === "number" && typeof job.longitude === "number")
    return [job.latitude, job.longitude];
  const angle = (index / Math.max(index + 1, 6)) * Math.PI * 2;
  const distance = 0.018 + (index % 4) * 0.006;
  return [center[0] + Math.cos(angle) * distance, center[1] + Math.sin(angle) * distance];
};

const createPriceIcon = (price: number, active: boolean) =>
  divIcon({
    className: "price-pin-wrapper",
    html: `<div class="price-pin${active ? " price-pin--active" : ""}">$${Math.round(price)}</div>`,
    iconSize: [76, 40],
    iconAnchor: [38, 20],
  });

/* ── component ── */
export default function Jobs() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [confirmJob, setConfirmJob] = useState<Job | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobWithDistance | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<JobFilter | null>(null);

  const mapCenterSet = React.useRef(false);
  const [flyTrigger, setFlyTrigger] = useState(0);

  /* ── FOMO badge ── */
  const getFomoBadge = (job: Job) => {
    const diff = Date.now() - new Date(job.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 10) return { label: t("jobs.just_posted"), icon: Zap, color: "bg-accent text-accent-foreground" };
    if (job.urgency === "urgent") return { label: t("jobs.urgent"), icon: Flame, color: "bg-accent text-accent-foreground" };
    if (job.urgency === "asap") return { label: t("jobs.asap"), icon: TrendingUp, color: "bg-accent text-accent-foreground" };
    if (job.price >= 200) return { label: t("jobs.high_value"), icon: Sparkles, color: "bg-accent text-accent-foreground" };
    return null;
  };

  /* ── fetch jobs + realtime ── */
  useEffect(() => { fetchJobs(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("new-jobs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs" }, (payload) => {
        const newJob = payload.new as Job;
        if (newJob.status === "open" && !newJob.hired_cleaner_id) {
          const tier = profile?.plan_tier || "free";
          const delay = tier === "pro" ? 0 : tier === "premium" ? 0 : 15000;
          setTimeout(() => {
            setJobs((prev) => {
              if (prev.some(j => j.id === newJob.id)) return prev;
              return [newJob, ...prev];
            });
            toast(t("jobs.new_job_nearby"), {
              description: `${newJob.title} — $${newJob.price}`,
              action: { label: t("jobs.claim_now"), onClick: () => setSelectedJob({ ...newJob, distanceMiles: null, etaMinutes: null }) },
              duration: 8000,
            });
          }, delay);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.plan_tier]);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "open")
      .is("hired_cleaner_id", null)
      .order("created_at", { ascending: false });
    setJobs((data as Job[]) || []);
    setLoading(false);
  };

  /* ── geolocation ── */
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const next: Coordinates = [coords.latitude, coords.longitude];
        setUserLocation(next);
        setLocationDenied(false);
        if (!mapCenterSet.current) { setMapCenter(next); mapCenterSet.current = true; }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setLocationDenied(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ── enrich jobs with distance/ETA ── */
  const enrichedJobs: JobWithDistance[] = useMemo(() => {
    return jobs.map((job, i) => {
      const pos = getJobPosition(job, i, mapCenter);
      if (userLocation) {
        const d = getDistanceMiles(userLocation, pos);
        return { ...job, distanceMiles: d, etaMinutes: estimateEtaMinutes(d) };
      }
      return { ...job, distanceMiles: null, etaMinutes: null };
    });
  }, [jobs, userLocation, mapCenter]);

  /* ── search + filter + sort ── */
  const filtered = useMemo(() => {
    let result = enrichedJobs.filter((job) =>
      [job.title, job.city || "", job.address || "", job.cleaning_type, job.description || ""]
        .join(" ").toLowerCase().includes(search.toLowerCase())
    );

    // Apply filter
    switch (activeFilter) {
      case "urgent":
        result = result.filter(j => j.urgency === "urgent" || j.urgency === "asap");
        break;
      case "residential":
        result = result.filter(j => j.cleaning_type === "residential");
        break;
      case "airbnb":
        result = result.filter(j => j.cleaning_type === "airbnb");
        break;
      case "commercial":
        result = result.filter(j => j.cleaning_type === "commercial");
        break;
      case "highest":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "nearest":
        if (userLocation) {
          result = [...result].sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
        }
        break;
      default:
        // Default: sort by nearest if location available
        if (userLocation) {
          result = [...result].sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
        }
    }

    return result;
  }, [enrichedJobs, search, activeFilter, userLocation]);

  /* ── clear selected if filtered out ── */
  useEffect(() => {
    if (selectedJob && !filtered.some(j => j.id === selectedJob.id)) setSelectedJob(null);
  }, [filtered, selectedJob]);

  /* ── accept logic ── */
  const canAcceptJob = () => {
    if (!profile) return false;
    const { maxJobs } = getJobLimits(profile.plan_tier || "free");
    if (maxJobs === Infinity) return true;
    const today = new Date().toISOString().split("T")[0];
    const usedToday = profile.jobs_used_date === today ? profile.jobs_used_today : 0;
    return usedToday < maxJobs;
  };

  const handleAcceptClick = (job: Job) => {
    if (!user || !profile) return;
    if (!canAcceptJob()) { setShowPaywall(true); return; }
    setConfirmJob(job);
  };

  const confirmAcceptJob = async (wantsProUpgrade: boolean) => {
    if (!confirmJob || !user || !profile) return;
    const job = confirmJob;
    setAccepting(job.id);
    try {
      if (wantsProUpgrade) {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await supabase.from("profiles").update({
          plan_tier: "pro", is_premium: true, premium_status: "trial",
          free_trial_started_at: now.toISOString(), free_trial_ends_at: trialEnd.toISOString(),
        }).eq("id", user.id);
        toast.success(t("common.upgraded_pro"));
      }
      const { data, error } = await supabase.functions.invoke("accept-job", { body: { jobId: job.id } });
      if (error) {
        const message = await error.context?.json().then((p: { error?: string }) => p.error).catch(() => null);
        throw new Error(message || error.message || t("common.failed_apply"));
      }
      if (!data?.success) throw new Error(data?.error || t("common.failed_apply"));
      await refreshProfile();
      setJobs(cur => cur.filter(item => item.id !== job.id));
      setSelectedJob(null);
      setConfirmJob(null);
      toast.success(t("common.job_accepted"));
      navigate(`/cleaner-my-jobs?tab=active&highlight=${job.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.failed_apply"));
    } finally {
      setAccepting(null);
    }
  };

  const scrollToJobCard = (jobId: string) => {
    if (mapExpanded) setMapExpanded(false);
    setTimeout(() => {
      document.getElementById(`job-card-${jobId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const mapHeight = mapExpanded ? "h-[85vh]" : "h-[52vh]";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ── MAP ── */}
      <section className={`relative ${mapHeight} min-h-[340px] overflow-hidden border-b border-border bg-card transition-all duration-300`}>
        <MapContainer center={mapCenter} zoom={11} zoomControl={false} className="h-full w-full">
          <MapViewportSync center={mapCenter} />
          <MapResizeSync expanded={mapExpanded} />
          <FlyToMyLocation trigger={flyTrigger} location={userLocation} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User location blue dot */}
          {userLocation && (
            <CircleMarker
              center={userLocation}
              radius={10}
              pathOptions={{ color: "hsl(var(--background))", fillColor: "hsl(var(--primary))", fillOpacity: 1, weight: 4 }}
            />
          )}

          {/* Job price pins */}
          {filtered.map((job, index) => (
            <Marker
              key={job.id}
              position={getJobPosition(job, index, mapCenter)}
              icon={createPriceIcon(job.price, selectedJob?.id === job.id)}
              eventHandlers={{ click: () => setSelectedJob(job) }}
            />
          ))}

          <ZoomControl position="bottomright" />
        </MapContainer>

        {/* Search bar */}
        <div className="absolute inset-x-4 top-4 z-[500]">
          <div className="bg-card/95 rounded-2xl border border-border px-4 py-3 shadow-elevated backdrop-blur">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("jobs.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 border-0 bg-transparent px-0 focus-visible:ring-0"
              />
              {userLocation && <Navigation className="h-4 w-4 text-primary" />}
            </div>
          </div>
        </div>

        {/* Job count badge */}
        <div className="absolute left-4 top-20 z-[500]">
          <Badge className="border-0 bg-card text-foreground shadow-card">
            {filtered.length} {t("jobs.available")}
          </Badge>
        </div>

        {/* Location denied banner */}
        {locationDenied && (
          <div className="absolute left-4 right-4 top-20 z-[500] mt-8">
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive border border-destructive/20">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Location access denied. Enable it in browser settings for distance & ETA.</span>
            </div>
          </div>
        )}

        {/* Recenter button */}
        {userLocation && (
          <button
            onClick={() => setFlyTrigger(c => c + 1)}
            className="absolute left-4 bottom-4 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-card border border-border shadow-elevated active:scale-95 transition-transform"
            aria-label="Center on my location"
          >
            <Navigation className="h-5 w-5 text-primary" />
          </button>
        )}

        {/* Expand / collapse handle */}
        <button
          onClick={() => setMapExpanded(prev => !prev)}
          className="absolute bottom-0 left-1/2 z-[500] -translate-x-1/2 translate-y-1/2 flex h-6 w-12 items-center justify-center rounded-full bg-card border border-border shadow-card"
          aria-label={mapExpanded ? "Collapse map" : "Expand map"}
        >
          {mapExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {/* Bottom sheet for selected job */}
        <AnimatePresence>
          {selectedJob && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-[500] px-3 pb-3"
            >
              <div className="rounded-3xl border border-border bg-card p-4 shadow-elevated">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="absolute right-6 top-5 text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >✕</button>

                <div className="mb-3 flex items-start justify-between gap-3 pr-6">
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-foreground">${selectedJob.price}</p>
                    <h2 className="truncate text-base font-semibold text-foreground">{selectedJob.title}</h2>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {selectedJob.city || selectedJob.address || "N/A"}
                    </p>
                  </div>
                  <Badge variant="outline">{selectedJob.cleaning_type}</Badge>
                </div>

                <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {selectedJob.bedrooms}</span>
                  <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {selectedJob.bathrooms}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {getTimeSince(selectedJob.created_at, t)}</span>
                  {selectedJob.distanceMiles !== null && (
                    <>
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" /> {formatDistance(selectedJob.distanceMiles)}
                      </span>
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <Car className="h-3 w-3" /> {formatEta(selectedJob.etaMinutes!)}
                      </span>
                    </>
                  )}
                </div>

                <Button
                  onClick={() => scrollToJobCard(selectedJob.id)}
                  className="h-11 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground"
                >
                  {t("cleaner_jobs.view_job")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── FILTERS ── */}
      <div className="px-4 pt-4 pb-2">
        <JobFilterChips active={activeFilter} onChange={setActiveFilter} />
      </div>

      {/* ── HEADER ── */}
      <div className="px-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">{t("jobs.nearby")}</h1>
        <p className="text-sm text-muted-foreground">{t("jobs.subtitle")}</p>
      </div>

      {/* ── JOB CARDS ── */}
      <div className="space-y-3 px-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <ShimmerCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Sparkles className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("jobs.no_jobs")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("jobs.check_back")}</p>
          </div>
        ) : (
          filtered.map((job, index) => {
            const fomo = getFomoBadge(job);
            const isRecent = Date.now() - new Date(job.created_at).getTime() < 600000;
            const isSelected = selectedJob?.id === job.id;

            return (
              <motion.div
                key={job.id}
                id={`job-card-${job.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, type: "spring", stiffness: 260, damping: 28 }}
                className={`rounded-3xl border bg-card p-4 shadow-card transition-all ${
                  isSelected ? "border-primary ring-2 ring-primary/15" : "border-border"
                }`}
                onClick={() => {
                  setSelectedJob(job);
                  setMapCenter(getJobPosition(job, index, mapCenter));
                }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold text-foreground">${job.price}</p>
                    <p className="text-sm font-semibold text-foreground">{job.title}</p>
                  </div>
                  {fomo && (
                    <Badge className={`${fomo.color} border-0 text-[10px]`}>
                      <fomo.icon className="mr-1 h-3 w-3" />
                      {fomo.label}
                    </Badge>
                  )}
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.city || job.address || "N/A"}</span>
                  <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {job.bedrooms}</span>
                  <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {job.bathrooms}</span>
                  <Badge variant="outline" className="text-[10px]">{job.cleaning_type}</Badge>
                </div>

                {/* Distance + ETA row */}
                <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {getTimeSince(job.created_at, t)}</span>
                  {isRecent && <span className="font-medium text-primary">• {t("jobs.new")}</span>}
                  {job.distanceMiles !== null && (
                    <>
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" /> {formatDistance(job.distanceMiles)}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-primary">
                        <Car className="h-3 w-3" /> ~{formatEta(job.etaMinutes!)}
                      </span>
                    </>
                  )}
                </div>

                {job.description && <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>}

                {profile?.role === "cleaner" && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleAcceptClick(job); }}
                    disabled={accepting === job.id}
                    className="h-11 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground"
                  >
                    {accepting === job.id ? t("jobs.applying") : t("jobs.apply")}
                  </Button>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      <PremiumModal open={showPaywall} onClose={() => setShowPaywall(false)} trigger="job_limit" />

      {confirmJob && (
        <JobConfirmationModal
          open={!!confirmJob}
          onClose={() => setConfirmJob(null)}
          onConfirm={confirmAcceptJob}
          loading={accepting === confirmJob.id}
          jobTitle={confirmJob.title}
          jobPrice={confirmJob.price}
          currentTier={profile?.plan_tier || "free"}
        />
      )}

      <BottomNav />
    </div>
  );
}
