// Upcoming Orange County Board of Supervisors meetings and Los Alamitos City Council meetings.
//   node scripts/data/local-meetings.mjs --probe     # print what the county pages expose
const probe = process.argv.includes("--probe");
async function text(url) {
  const r = await fetch(url, { headers: { "user-agent": "civic-atlas (https://civic-atlas-cub.pages.dev)" } });
  return { status: r.status, body: await r.text() };
}
if (probe) {
  for (const u of ["https://board.oc.gov/meetings-agendas", "https://cob.oc.gov/"]) {
    const { status, body } = await text(u);
    console.log(`\n# ${u} ${status} ${body.length} bytes`);
    const hits = new Set([...body.matchAll(/(?:src|href|data-[a-z-]+)="([^"]*(?:agenda|meeting|api|json|ExtDoc|granicus|legistar|calendar)[^"]*)"/gi)].map((m) => m[1]));
    for (const h of hits) console.log("  ", h);
    const scripts = [...body.matchAll(/<script[^>]*src="([^"]+)"/gi)].map((m) => m[1]);
    console.log("  scripts:", scripts.join(" "));
    const tbl = body.match(/<table[\s\S]{0,4000}/i);
    console.log("  table:", tbl ? tbl[0].replace(/\s+/g, " ").slice(0, 2500) : "(none)");
  }
}
