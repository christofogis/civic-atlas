-- Sponsor and cosponsors of a bill with the party and seat each held on the day they signed on
-- (party as recorded on that term, not caucus), for bill pages.

create view bill_sponsor_details with (security_invoker = true) as
select b.congress, b.bill_type, b.number, b.sponsor_bioguide_id as bioguide_id,
       coalesce(m.official_full_name, m.first_name || ' ' || m.last_name) as name,
       t.party, t.chamber, t.state, t.district
from bills b
join members m on m.bioguide_id = b.sponsor_bioguide_id
left join lateral (
  select party, chamber, state, district from terms
  where bioguide_id = b.sponsor_bioguide_id and b.introduced_date between start_date and end_date
  order by start_date desc limit 1
) t on true;

create view bill_cosponsor_details with (security_invoker = true) as
select c.congress, c.bill_type, c.number, c.bioguide_id,
       coalesce(m.official_full_name, m.first_name || ' ' || m.last_name) as name,
       m.last_name, t.party, t.chamber, t.state, t.district,
       c.sponsored_date, c.withdrawn_date, c.is_original
from bill_cosponsors c
join members m using (bioguide_id)
join bills b using (congress, bill_type, number)
left join lateral (
  select party, chamber, state, district from terms
  where bioguide_id = c.bioguide_id
    and coalesce(c.sponsored_date, b.introduced_date) between start_date and end_date
  order by start_date desc limit 1
) t on true;
