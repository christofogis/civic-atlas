// Registration links for the "First time voting?" page. Official sources only, and no rules stated
// here: deadlines, ID and pre-registration ages differ by state and change, so the page links to the
// offices that publish them. vote.gov (the U.S. government's registration site) is first for everyone
// and leads to every state. A state's own links are added only where we have checked them; today that
// is California. Every link below was checked to respond in Nov 2026 (scripts/probe/first_voter_links.py;
// vote.gov refuses scripted requests from GitHub's servers, so it was checked from a browser-style fetch).

export const VOTE_GOV = { en: "https://vote.gov/", es: "https://vote.gov/es/" };

const STATE_LINKS = {
  CA: [
    { id: "register", en: "https://registertovote.ca.gov/", es: "https://registertovote.ca.gov/es" },
    { id: "status", en: "https://voterstatus.sos.ca.gov/" },
    { id: "preregister", en: "https://www.sos.ca.gov/elections/pre-register-16-vote-18" },
  ],
};

// The 26th Amendment (voting at 18), as published by the National Archives.
export const AMENDMENT_26 = "https://www.archives.gov/founding-docs/amendments-11-27";

// The state from a saved lookup's link parameters ("st=CA&cg=120&cd=47"), or null.
export function savedState(saved) {
  if (!saved) return null;
  const st = new URLSearchParams(saved).get("st");
  return st && /^[A-Za-z]{2}$/.test(st) ? st.toUpperCase() : null;
}

// [{ id, url }]: vote.gov first, then the state's own links when we have them.
export function registrationLinks(state, lang = "en") {
  const pick = (l) => (lang === "es" && l.es) || l.en;
  const own = (STATE_LINKS[state] ?? []).map((l) => ({ id: `${state.toLowerCase()}-${l.id}`, url: pick(l) }));
  return [{ id: "vote.gov", url: pick(VOTE_GOV) }, ...own];
}
