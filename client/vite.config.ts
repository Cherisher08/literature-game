import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on 0.0.0.0 so phones and other machines on the LAN can reach the
    // dev server. Vite proxies /socket.io to the API on this same host, so the
    // browser only ever talks to one origin and no CORS setup is needed.
    host: true,
    port: 5173,
    // Fail loudly instead of silently starting a second instance on 5174.
    // A stray second dev server serves stale modules and looks like a UI bug.
    strictPort: true,
    proxy: {
      // 127.0.0.1, not "localhost": the API binds 0.0.0.0 (IPv4 only), while
      // "localhost" on Windows resolves to ::1 first. Naming IPv4 explicitly
      // skips a connection attempt that always fails.
      "/socket.io": { target: "http://127.0.0.1:3001", ws: true },
    },
  },
});
