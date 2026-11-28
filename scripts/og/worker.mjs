// One drawing thread for scripts/og/build.mjs: renders its share of the cards and writes them.
import { writeFileSync } from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import { renderCard } from "./render.mjs";

let written = 0, failed = 0;
for (const { spec, portrait } of workerData.jobs) {
  try {
    writeFileSync(`${workerData.out}${spec.path.slice(1)}`, await renderCard(spec, portrait));
    written++;
  } catch (e) {
    failed++;
    if (failed <= 5) console.log(`og: ${spec.path} failed: ${e.message}`);
  }
}
parentPort.postMessage({ written, failed });
