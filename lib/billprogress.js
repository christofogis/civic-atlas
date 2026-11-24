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

// Steps shown on a bill page, by bill type. Each step: label and the date it happened (or null).
export function billSteps(b) {
  const intro = { label: "Introduced", date: b.introduced_date };
  const reported = { label: "Reported by committee", date: b.reported_date, optional: true };
  const house = { label: b.failed_house_date && !b.passed_house_date ? "Failed in House" : "Passed House", date: b.passed_house_date ?? b.failed_house_date, failed: Boolean(b.failed_house_date && !b.passed_house_date) };
  const senate = { label: b.failed_senate_date && !b.passed_senate_date ? "Failed in Senate" : "Passed Senate", date: b.passed_senate_date ?? b.failed_senate_date, failed: Boolean(b.failed_senate_date && !b.passed_senate_date) };
  const president = { label: "To President", date: b.presented_date };
  const law = b.vetoed_date && !b.became_law_date
    ? { label: "Vetoed", date: b.vetoed_date, failed: true }
    : { label: b.law_number ? `Became law (${b.law_number})` : "Became law", date: b.became_law_date };
  const t = b.bill_type;
  // The originating chamber goes first.
  const chambers = t.startsWith("s") ? [senate, house] : [house, senate];
  if (t === "hres") return [intro, reported, { ...house, label: house.failed ? "Failed in House" : "Agreed to in House" }];
  if (t === "sres") return [intro, reported, { ...senate, label: senate.failed ? "Failed in Senate" : "Agreed to in Senate" }];
  if (t === "hconres" || t === "sconres") return [intro, reported, ...chambers];
  return [intro, reported, ...chambers, president, law];
}
