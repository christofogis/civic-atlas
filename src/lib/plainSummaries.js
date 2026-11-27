// Published AI plain-language summaries of whole bills (bill_plain_summaries, written and checked by
// scripts/ingest/bill-summaries.mjs from each bill's CRS summary). The table's read policy returns a
// summary only once it passed the check and only while it matches the CRS summary the site shows.
import { useEffect, useState } from "react";
import { db } from "./db.js";

const COLS = "congress,bill_type,number,lead_en,lead_es,points_en,points_es";
export const plainKey = (c, t, n) => `${c}-${String(t).toLowerCase()}-${n}`;

// [{congress, bill_type, number}] -> PostgREST or() groups, one per Congress and bill type.
export function plainFilter(bills) {
  const groups = new Map();
  for (const b of bills) {
    if (!b?.bill_type || !b.number || !b.congress) continue;
    const g = `${b.congress}|${String(b.bill_type).toLowerCase()}`;
    groups.set(g, new Set([...(groups.get(g) ?? []), Number(b.number)]));
  }
  return [...groups.entries()].map(([g, ns]) => {
    const [c, t] = g.split("|");
    return `and(congress.eq.${c},bill_type.eq.${t},number.in.(${[...ns].sort((a, z) => a - z).join(",")}))`;
  });
}

export async function fetchPlainSummaries(bills) {
  const out = new Map();
  const groups = plainFilter(bills);
  // A few groups per request keeps the URL short; lists have one or a handful of groups anyway.
  for (let i = 0; i < groups.length; i += 8) {
    const { data, error } = await db.from("bill_plain_summaries").select(COLS).or(groups.slice(i, i + 8).join(","));
    if (error) return out;   // the summaries are an aid; the list shows as before without them
    for (const r of data ?? []) out.set(plainKey(r.congress, r.bill_type, r.number), r);
  }
  return out;
}

// Map of plainKey -> row for the bills given (an empty Map until loaded, or if none).
export function usePlainSummaries(bills) {
  const sig = plainFilter(bills ?? []).join(",");
  const [map, setMap] = useState(() => new Map());
  useEffect(() => {
    if (!sig) { setMap(new Map()); return; }
    let live = true;
    fetchPlainSummaries(bills).then((m) => live && setMap(m)).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return map;
}

// Normalize bill-like rows that use bill_congress/bill_number (votes) to {congress, bill_type, number}.
export const voteBill = (v) => (v?.bill_type ? { congress: v.bill_congress, bill_type: v.bill_type, number: v.bill_number } : null);
