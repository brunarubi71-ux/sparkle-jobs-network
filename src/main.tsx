import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

// Bump this whenever a breaking change (e.g. Supabase key rotation) requires
// all clients to purge their cached state and reload.
const APP_VERSION = "5";
const VERSION_KEY = "shinely_app_version";

async function clearAndReload() {
  // Wipe Supabase auth stored in localStorage
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith("sb-") || k.startsWith("supabase")) {
      localStorage.removeItem(k);
    }
  });
  localStorage.setItem(VERSION_KEY, APP_VERSION);

  // Unregister old service workers and clear all caches
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
const isOAuthCallback = window.location.hash.includes("access_token") || window.location.search.includes("code=") || window.location.search.includes("error=");
if (storedVersion !== APP_VERSION && !isOAuthCallback) {
  clearAndReload();
} else {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
