import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

// Bump this whenever a breaking change requires all clients to purge SW cache.
// Do NOT clear sb-* session keys here — that logs everyone out on every update.
const APP_VERSION = "7";
const VERSION_KEY = "shinely_app_version";

async function clearAndReload() {
  localStorage.setItem(VERSION_KEY, APP_VERSION);

  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  }

  window.location.reload();
}

const storedVersion = localStorage.getItem(VERSION_KEY);
const isOAuthCallback =
  window.location.hash.includes("access_token") ||
  window.location.search.includes("code=") ||
  window.location.search.includes("error=");

if (storedVersion !== APP_VERSION && !isOAuthCallback) {
  clearAndReload();
} else {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
