// Bill milestones from a Bill Status action list. Uses the Library of Congress action codes
// (sourceSystem code 9), which are the same in both chambers:
//   1000 introduced · 5000/14000 reported · 8000/9000 House passed/failed ·
//   17000/18000 Senate passed/failed · 28000 presented to President · 31000 vetoed ·
//   36000 became law
const CODES = {
  5000: "reported_date", 14000: "reported_date",
  8000: "passed_house_date", 9000: "failed_house_date",
  17000: "passed_senate_date", 18000: "failed_senate_date",
  28000: "presented_date", 31000: "vetoed_date", 36000: "became_law_date",
};

export function billProgress(actions, laws) {
  const out = Object.fromEntries(Object.values(CODES).map((k) => [k, null]));
  for (const a of actions ?? []) {
    if (String(a?.sourceSystem?.code ?? "") !== "9") continue;
    const field = CODES[Number(a.actionCode)];
    const day = String(a.actionDate ?? "").slice(0, 10);
    if (!field || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    // 36000 also marks "Signed by President"; only "Became ... Law" counts as enactment.
    if (field === "became_law_date" && !/Became (Public|Private) Law/i.test(String(a.text))) continue;
    if (!out[field] || day < out[field]) out[field] = day;
  }
  const law = (Array.isArray(laws) ? laws : laws ? [laws] : [])[0];
  out.law_number = law?.number ? `${law.type ?? "Public Law"} ${law.number}` : null;
  return out;
}

// The steps shown on a bill page are built from these fields in lib/billTrack.js.
