import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/agent/scanner": {
        target: "http://localhost:4001",
        rewrite: (path) => path.replace(/^\/agent\/scanner/, ""),
      },
      "/agent/enricher": {
        target: "http://localhost:4002",
        rewrite: (path) => path.replace(/^\/agent\/enricher/, ""),
      },
      "/agent/analyst": {
        target: "http://localhost:4003",
        rewrite: (path) => path.replace(/^\/agent\/analyst/, ""),
      },
      "/agent/distributor": {
        target: "http://localhost:4004",
        rewrite: (path) => path.replace(/^\/agent\/distributor/, ""),
      },
      "/agent/trader": {
        target: "http://localhost:4005",
        rewrite: (path) => path.replace(/^\/agent\/trader/, ""),
      },
    },
  },
});
