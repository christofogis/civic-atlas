import { db } from "./db.js";

// Characters allowed in a name search. Keeps PostgREST filter syntax (commas, parentheses)
// out of the query.
export const cleanName = (s) => String(s ?? "").replace(/[^\p{L}\p{M}\s'.-]/gu, " ").replace(/\s+/g, " ").trim();

export async function searchMembers(q, limit = 20) {
  const name = cleanName(q);
  if (name.length < 2) return [];
  const words = name.split(" ").filter((w) => w.length > 1);
  let query = db.from("member_directory").select("bioguide_id,name,chamber,state,district,party,serving,end_date");
  // Every word must appear in the full name, last name or nickname.
  for (const w of words) query = query.or(`name.ilike.*${w}*,last_name.ilike.*${w}*,nickname.ilike.*${w}*`);
  const { data, error } = await query.order("serving", { ascending: false }).order("last_name").limit(limit);
  if (error) throw error;
  return data;
}
