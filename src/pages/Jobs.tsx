import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Bed, Bath, Clock, Sparkles, Flame, Zap, TrendingUp, Navigation } from "lucide-react";
import { MapContainer, TileLayer, Marker, CircleMarker, ZoomControl, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ShimmerCard from "@/components/ShimmerCard";
import PremiumModal from "@/components/PremiumModal";
import JobConfirmationModal from "@/components/JobConfirmationModal";
import BottomNav from "@/components/BottomNav";
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

function MapViewportSync({ center }: { center: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
    const timeout = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timeout);
  }, [center, map]);

  return null;
}

const getTimeSince = (dateStr: string, t: (key: string) => string) => {
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
    case "pro":
      return { maxJobs: Infinity };
    case "premium":
      return { maxJobs: 3 };
    default:
      return { maxJobs: 2 };
  }
}

const getJobPosition = (job: Job, index: number, center: Coordinates): Coordinates => {
  if (typeof job.latitude === "number" && typeof job.longitude === "number") {
    return [job.latitude, job.longitude];
  }

  const angle = (index / Math.max(index + 1, 6)) * Math.PI * 2;
  const distance = 0.018 + (index % 4) * 0.006;
  return [
    center[0] + Math.cos(angle) * distance,
    center[1] + Math.sin(angle) * distance,
  ];
};

const createPriceIcon = (price: number, active: boolean) =>
  divIcon({
    className: "price-pin-wrapper",
    html: `<div class="price-pin${active ? " price-pin--active" : ""}">$${Math.round(price)}</div>`,
    iconSize: [76, 40],
    iconAnchor: [38, 20],
  });

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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const mapCenterSet = React.useRef(false);

  const getFomoBadge = (job: Job) => {
    const diff = Date.now() - new Date(job.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 10) return { label: t("jobs.just_posted"), icon: Zap, color: "bg-accent text-accent-foreground" };
    if (job.urgency === "urgent") return { label: t("jobs.urgent"), icon: Flame, color: "bg-accent text-accent-foreground" };
    if (job.urgency === "asap") return { label: t("jobs.asap"), icon: TrendingUp, color: "bg-accent text-accent-foreground" };
    if (job.price >= 200) return { label: t("jobs.high_value"), icon: Sparkles, color: "bg-accent text-accent-foreground" };
    return null;
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const nextCenter: Coordinates = [coords.latitude, coords.longitude];
        setUserLocation(nextCenter);
        if (!mapCenterSet.current) {
          setMapCenter(nextCenter);
          mapCenterSet.current = true;
        }
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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

  const canAcceptJob = () => {
    if (!profile) return false;
    const tier = profile.plan_tier || "free";
    const { maxJobs } = getJobLimits(tier);
    if (maxJobs === Infinity) return true;
    const today = new Date().toISOString().split("T")[0];
    const usedToday = profile.jobs_used_date === today ? profile.jobs_used_today : 0;
    return usedToday < maxJobs;
  };

  const handleAcceptClick = (job: Job) => {
    if (!user || !profile) return;
    if (!canAcceptJob()) {
      setShowPaywall(true);
      return;
    }
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
        await supabase
          .from("profiles")
          .update({
            plan_tier: "pro",
            is_premium: true,
            premium_status: "trial",
            free_trial_started_at: now.toISOString(),
            free_trial_ends_at: trialEnd.toISOString(),
          })
          .eq("id", user.id);
        toast.success(t("common.upgraded_pro"));
      }

      const { data, error } = await supabase.functions.invoke("accept-job", {
        body: { jobId: job.id },
      });

      if (error) {
        const message = await error.context
          ?.json()
          .then((payload: { error?: string }) => payload.error)
          .catch(() => null);
        throw new Error(message || error.message || t("common.failed_apply"));
      }

      if (!data?.success) {
        throw new Error(data?.error || t("common.failed_apply"));
      }

      await refreshProfile();
      setJobs((current) => current.filter((item) => item.id !== job.id));
      setSelectedJob(null);
      setConfirmJob(null);
      toast.success(t("common.job_accepted"));
      navigate(`/cleaner-my-jobs?tab=active&highlight=${job.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed_apply"));
    } finally {
      setAccepting(null);
    }
  };

  const filtered = useMemo(
    () =>
      jobs.filter((job) =>
        [job.title, job.city || "", job.address || "", job.cleaning_type, job.description || ""]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [jobs, search]
  );

  useEffect(() => {
    if (selectedJob && !filtered.some((job) => job.id === selectedJob.id)) {
      setSelectedJob(null);
    }
  }, [filtered, selectedJob]);

  const scrollToJobCard = (jobId: string) => {
    const card = document.getElementById(`job-card-${jobId}`);
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <section className="relative h-[58vh] min-h-[400px] overflow-hidden border-b border-border bg-card">
        <MapContainer center={mapCenter} zoom={11} zoomControl={false} className="h-full w-full">
          <MapViewportSync center={mapCenter} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {userLocation && (
            <CircleMarker
              center={userLocation}
              radius={10}
              pathOptions={{
                color: "hsl(var(--background))",
                fillColor: "hsl(var(--primary))",
                fillOpacity: 1,
                weight: 4,
              }}
            />
          )}

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

        <div className="absolute inset-x-4 top-4 z-[500]">
          <div className="bg-card/95 rounded-2xl border border-border px-4 py-3 shadow-elevated backdrop-blur">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("jobs.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-8 border-0 bg-transparent px-0 focus-visible:ring-0"
              />
              {userLocation && <Navigation className="h-4 w-4 text-primary" />}
            </div>
          </div>
        </div>

        <div className="absolute left-4 top-20 z-[500]">
          <Badge className="border-0 bg-card text-foreground shadow-card">
            {filtered.length} {t("jobs.available")}
          </Badge>
        </div>

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
                >
                  ✕
                </button>

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
                  <span className="flex items-center gap-1">
                    <Bed className="h-3 w-3" /> {selectedJob.bedrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="h-3 w-3" /> {selectedJob.bathrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {getTimeSince(selectedJob.created_at, t)}
                  </span>
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

      <div className="px-4 py-4">
        <h1 className="text-2xl font-bold text-foreground">{t("jobs.nearby")}</h1>
        <p className="text-sm text-muted-foreground">{t("jobs.subtitle")}</p>
      </div>

      <div className="space-y-3 px-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <ShimmerCard key={index} />)
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
                transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 28 }}
                className={`rounded-3xl border bg-card p-4 shadow-card transition-all ${
                  isSelected ? "border-primary ring-2 ring-primary/15" : "border-border"
                }`}
                onClick={() => { setSelectedJob(job); setMapCenter(getJobPosition(job, index, mapCenter)); }}
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
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {job.city || job.address || "N/A"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bed className="h-3 w-3" /> {job.bedrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="h-3 w-3" /> {job.bathrooms}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {job.cleaning_type}
                  </Badge>
                </div>

                <div className="mb-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{getTimeSince(job.created_at, t)}</span>
                  {isRecent && <span className="font-medium text-primary">• {t("jobs.new")}</span>}
                </div>

                {job.description && <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>}

                {profile?.role === "cleaner" && (
                  <Button
                    onClick={() => handleAcceptClick(job)}
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
