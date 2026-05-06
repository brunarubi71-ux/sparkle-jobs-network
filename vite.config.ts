import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        // Manually chunk a few stable, big vendor groups. Recharts + d3 are
        // intentionally NOT chunked together: they have circular module
        // dependencies that throw "Cannot access X before initialization"
        // at runtime when forced into a single chunk. Letting Vite's default
        // splitter handle them keeps the bindings ordered correctly.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || id.match(/[\\/]react[\\/]/)) return "react-vendor";
          if (id.includes("@tanstack")) return "query-vendor";
          if (id.includes("@radix-ui")) return "radix-vendor";
          if (id.includes("@stripe") || id.includes("stripe-js")) return "stripe-vendor";
          if (id.includes("@supabase") || id.includes("@lovable.dev/cloud-auth")) return "supabase-vendor";
          if (id.includes("framer-motion")) return "motion-vendor";
          if (id.includes("date-fns")) return "date-vendor";
          return undefined;
        },
      },
    },
  },
}));
