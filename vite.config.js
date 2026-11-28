import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { publicData } from "./lib/constitution.js";

// /data/constitution/us.json: built from data/constitution/us.json (the text and every AI summary's
// state), keeping only what the page may show (lib/constitution.js publicData). One source file in the
// repo; the served copy is never committed.
const CONSTITUTION = "data/constitution/us.json";
const constitutionJson = () => JSON.stringify(publicData(JSON.parse(readFileSync(CONSTITUTION, "utf8"))));
function constitutionData() {
  return {
    name: "constitution-data",
    configureServer(server) {
      server.middlewares.use("/data/constitution/us.json", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(constitutionJson());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "data/constitution/us.json", source: constitutionJson() });
    },
  };
}

export default defineConfig({
  plugins: [react(), constitutionData()],
});
