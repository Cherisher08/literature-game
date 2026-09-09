import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Fail loudly instead of silently starting a second instance on 5174.
    // A stray second dev server serves stale modules and looks like a UI bug.
    strictPort: true,
    proxy: {
      "/socket.io": { target: "http://localhost:3001", ws: true },
    },
  },
});
