
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { luxxApiPlugin } from "./server/api.js";

export default defineConfig({
  plugins: [luxxApiPlugin(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
