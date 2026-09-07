import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${process.env.NONSTOPVIBIN_PORT || 4318}`,
    },
  },
  build: { target: "chrome152", outDir: "dist/client", sourcemap: false },
});
