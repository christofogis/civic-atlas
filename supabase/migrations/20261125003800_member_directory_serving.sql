-- A term ends at noon on its end date (Jan 3 for a Congress), when the next term begins. Treat the
-- end date as the first day *not* served, as seat_holders does: otherwise on Jan 3 every departing
-- member still reads as serving, beside the new members, and the map shows the previous
-- Congress's member in a district whose lines just changed.
create or replace view member_directory with (security_invoker = true) as
select m.bioguide_id,
       coalesce(m.official_full_name, m.first_name || ' ' || m.last_name) as name,
       m.first_name, m.last_name, m.nickname,
       t.chamber, t.state, t.district, t.party, t.start_date, t.end_date,
       (current_date >= t.start_date and current_date < t.end_date) as serving
from members m
join lateral (
  select chamber, state, district, party, start_date, end_date from terms
  where bioguide_id = m.bioguide_id order by start_date desc limit 1
) t on true;
