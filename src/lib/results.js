// Loads the election results files when a page needs them (they are static files, a few hundred KB
// each), once per visit.
let index;
const files = new Map();

export function resultsIndex() {
  index ??= fetch("/data/results/index.json").then((r) => (r.ok ? r.json() : { files: [] })).catch(() => ({ files: [] }));
  return index;
}

export function resultsFile(name) {
  if (!files.has(name)) {
    const p = fetch(`/data/results/${name}`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
    p.catch(() => files.delete(name));
    files.set(name, p);
  }
  return files.get(name);
}

// Every year's file, newest year first.
export async function allResults() {
  const { files: list } = await resultsIndex();
  return Promise.all([...list].sort((a, z) => z.year - a.year).map((f) => resultsFile(f.file)));
}

// One year's file, or null when there is none.
export async function resultsFor(year) {
  const { files: list } = await resultsIndex();
  const f = list.find((x) => x.year === year);
  return f ? resultsFile(f.file) : null;
}
