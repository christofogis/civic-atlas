// One drawing thread for scripts/og/build.mjs: renders its share of the cards and writes them.
import { writeFileSync, renameSync } from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import { renderCard } from "./render.mjs";

let written = 0, failed = 0;
for (const { spec, portrait } of workerData.jobs) {
  try {
    // Write then rename, so a thread stopped at the time limit never leaves half a PNG behind.
    const file = `${workerData.out}${spec.path.slice(1)}`;
    writeFileSync(`${file}.tmp`, await renderCard(spec, portrait));
    renameSync(`${file}.tmp`, file);
    written++;
    if (written % 1000 === 0) console.log(`og: worker ${workerData.id}: ${written} of ${workerData.jobs.length}`);
  } catch (e) {
    failed++;
    if (failed <= 5) console.log(`og: ${spec.path} failed: ${e.message}`);
  }
}
parentPort.postMessage({ written, failed });
