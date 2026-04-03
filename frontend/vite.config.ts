import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/research": "http://localhost:4000",
      "/quick": "http://localhost:4000",
      "/pnl": "http://localhost:4000",
      "/defi": "http://localhost:4000",
      "/history": "http://localhost:4000",
      "/nft": "http://localhost:4000",
      "/compare": "http://localhost:4000",
      "/balance": "http://localhost:4000",
      "/swap": "http://localhost:4000",
      "/bridge": "http://localhost:4000",
      "/send": "http://localhost:4000",
      "/watch": "http://localhost:4000",
      "/api": "http://localhost:4000",
      "/health": "http://localhost:4000",
    },
  },
});
