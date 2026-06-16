import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// @solana/web3.js + spl-token need Node globals (Buffer/process) in the browser.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  optimizeDeps: { include: ["@solana/web3.js", "@solana/spl-token"] },
  server: { port: 5173 },
});
