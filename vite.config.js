import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { buildCorrections } from "./lib/corrections.js";

// /data/corrections.json: the public corrections log as data, built from data/corrections/ (the
// same entries the /corrections page shows), so it can't drift from the page.
function correctionsJson() {
  const read = (f) => JSON.parse(readFileSync(new URL(`./data/corrections/${f}`, import.meta.url), "utf8"));
  const body = () => JSON.stringify({ about: "Corrections to what civic-atlas shows, newest first. See /corrections.", entries: buildCorrections(read("log.json"), read("leadership.json")) }, null, 1);
  return {
    name: "corrections-json",
    configureServer(server) {
      server.middlewares.use("/data/corrections.json", (_req, res) => { res.setHeader("Content-Type", "application/json"); res.end(body()); });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "data/corrections.json", source: body() });
    },
  };
}

export default defineConfig({
  plugins: [react(), correctionsJson()],
});
