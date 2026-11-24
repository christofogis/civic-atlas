-- Search, browse and comparison support.

-- One row per member with their most recent term, for search results and the members list.
create view member_directory with (security_invoker = true) as
select m.bioguide_id,
       coalesce(m.official_full_name, m.first_name || ' ' || m.last_name) as name,
       m.first_name, m.last_name, m.nickname,
       t.chamber, t.state, t.district, t.party, t.start_date, t.end_date,
       (current_date between t.start_date and t.end_date) as serving
from members m
join lateral (
  select chamber, state, district, party, start_date, end_date from terms
  where bioguide_id = m.bioguide_id order by start_date desc limit 1
) t on true;

-- Full-text search over bill titles.
alter table bills add column search tsvector
  generated always as (to_tsvector('english', coalesce(short_title, '') || ' ' || coalesce(title, ''))) stored;
create index bills_search_idx on bills using gin (search);
create index bills_policy_idx on bills (congress, policy_area);
create index bills_latest_action_idx on bills (latest_action_date desc);

-- Clients reporting lobbying per bill, stored so lists can sort by it. Refreshed by the
-- lobbying ingest job.
create table bill_lobbying_totals (
  congress   smallint not null,
  bill_type  text not null,
  number     integer not null,
  clients    integer not null,
  primary key (congress, bill_type, number)
);
create index bill_lobbying_totals_clients_idx on bill_lobbying_totals (clients desc);
alter table bill_lobbying_totals enable row level security;
create policy "public read" on bill_lobbying_totals for select using (true);

create or replace function refresh_bill_lobbying_totals() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.bill_lobbying_totals where true;  -- explicit WHERE: pg-safeupdate
  insert into public.bill_lobbying_totals (congress, bill_type, number, clients)
  select m.congress, m.bill_type, m.number, count(distinct f.client_id)
  from public.lobbying_bill_mentions m join public.lobbying_filings f using (filing_uuid)
  group by 1, 2, 3;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function refresh_bill_lobbying_totals() from public, anon, authenticated;
grant execute on function refresh_bill_lobbying_totals() to service_role;

-- Bills for lists: sponsor (party and seat on the day introduced) and lobbying count.
create view bill_list with (security_invoker = true) as
select b.congress, b.bill_type, b.number, b.title, b.short_title, b.introduced_date,
       b.latest_action_date, b.latest_action_text, b.policy_area, b.search,
       s.bioguide_id as sponsor_bioguide_id, s.name as sponsor_name, s.party as sponsor_party,
       s.chamber as sponsor_chamber, s.state as sponsor_state, s.district as sponsor_district,
       coalesce(l.clients, 0) as lobbying_clients
from bills b
left join bill_sponsor_details s using (congress, bill_type, number)
left join bill_lobbying_totals l using (congress, bill_type, number);

-- How often two members cast the same vote. Counts only roll calls where both voted Yea or Nay
-- (or the Senate's Guilty/Not Guilty), grouped by Congress, plus the votes where they differed.
create or replace function member_agreement(a text, b text)
returns json language sql stable set search_path = '' as $$
  with pairs as (
    select v.vote_id, v.congress, v.chamber, v.voted_at, v.question, v.description, v.result, v.source_url,
           v.bill_congress, v.bill_type, v.bill_number,
           pa.position as a_position, pb.position as b_position,
           pa.position_category as a_cat, pb.position_category as b_cat
    from public.vote_positions pa
    join public.vote_positions pb on pb.vote_id = pa.vote_id and pb.bioguide_id = b
    join public.votes v on v.vote_id = pa.vote_id
    where pa.bioguide_id = a
  )
  select json_build_object(
    'by_congress', coalesce((
      select json_agg(x order by x.congress desc) from (
        select congress, chamber,
               count(*) as shared_roll_calls,
               count(*) filter (where a_cat in ('yes', 'no') and b_cat in ('yes', 'no')) as both_voted,
               count(*) filter (where a_cat in ('yes', 'no') and a_cat = b_cat) as same,
               count(*) filter (where a_cat in ('yes', 'no') and b_cat in ('yes', 'no') and a_cat <> b_cat) as different
        from pairs group by congress, chamber) x), '[]'::json),
    'differed', coalesce((
      select json_agg(d order by d.voted_at desc) from (
        select vote_id, congress, chamber, voted_at, question, description, result, source_url,
               bill_congress, bill_type, bill_number, a_position, b_position
        from pairs
        where a_cat in ('yes', 'no') and b_cat in ('yes', 'no') and a_cat <> b_cat
        order by voted_at desc limit 500) d), '[]'::json)
  );
$$;
grant execute on function member_agreement(text, text) to anon, authenticated;
