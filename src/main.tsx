import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";

// Visible-on-screen error reporter for cases where the React tree itself
// fails to mount (which leaves the page blank because the document body
// is empty and the GlobalErrorBoundary inside <App /> never gets to run).
function showStartupError(label: string, err: unknown) {
  try {
    const root = document.getElementById("root");
    if (!root) return;
    const message =
      err instanceof Error ? `${err.name}: ${err.message}\n\n${err.stack ?? ""}` : String(err);
    root.innerHTML = `
      <div style="min-height:100vh;background:#F5F0FF;color:#1a1a1a;padding:24px 16px;font-family:system-ui,-apple-system,sans-serif;">
        <div style="max-width:640px;margin:0 auto;">
          <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#7c3aed;">Shinely — falha ao iniciar</h1>
          <p style="font-size:14px;color:#555;margin:0 0 16px;">${label}. Tira print desta tela para o suporte.</p>
          <pre style="background:#fff;border:1px solid #e5d8fb;border-radius:12px;padding:12px;font-size:11px;line-height:1.4;max-height:340px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:#b91c1c;"></pre>
          <button id="__shinely_reset" style="margin-top:16px;padding:10px 16px;border-radius:12px;background:#7c3aed;color:white;font-weight:600;font-size:14px;border:none;cursor:pointer;">Limpar dados e tentar de novo</button>
        </div>
      </div>
    `;
    const pre = root.querySelector("pre");
    if (pre) pre.textContent = message;
    const btn = root.querySelector("#__shinely_reset") as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener("click", () => {
        try { localStorage.clear(); } catch {/* ignore */}
        try { sessionStorage.clear(); } catch {/* ignore */}
        window.location.reload();
      });
    }
  } catch {
    // Last resort — at least put SOMETHING visible on the page.
    try {
      document.body.innerText = `Shinely failed to start: ${String(err)}`;
    } catch {/* nothing more we can do */}
  }
}

window.addEventListener("error", (event) => {
  if (event.error) showStartupError("Erro JavaScript não tratado", event.error);
});
window.addEventListener("unhandledrejection", (event) => {
  showStartupError("Promise rejeitada sem tratamento", event.reason);
});

(async () => {
  try {
    const { default: App } = await import("./App.tsx");
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Root element not found in DOM");
    }
    createRoot(container).render(<App />);
  } catch (err) {
    showStartupError("Falha ao carregar a aplicação", err);
  }
})();
