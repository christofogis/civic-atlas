-- Store vote positions against a 4-byte vote key instead of the text vote_id
-- ('house-118-1-123'). vote_positions is the largest table (~1M rows a Congress pair); its
-- primary-key index alone was 70 MB. Views keep exposing vote_id, so readers don't change.

alter table votes add column vote_key integer generated always as identity;
alter table votes add constraint votes_vote_key_key unique (vote_key);

create table vote_positions_new (
  vote_key          integer not null references votes (vote_key) on delete cascade,
  bioguide_id       text not null references members,
  position          text not null,
  position_category text not null check (position_category in ('yes', 'no', 'present', 'not_voting', 'other')),
  party_at_vote     text not null,
  state_at_vote     char(2) not null
);
insert into vote_positions_new
select v.vote_key, p.bioguide_id, p.position, p.position_category, p.party_at_vote, p.state_at_vote
from vote_positions p join votes v using (vote_id)
order by v.vote_key, p.bioguide_id;

drop view member_votes;
drop view vote_position_details;
drop table vote_positions;
alter table vote_positions_new rename to vote_positions;
alter table vote_positions add primary key (vote_key, bioguide_id);
create index vote_positions_member_idx on vote_positions (bioguide_id);
comment on column vote_positions.position is 'Exact wording from the clerk; position_category is for counting only.';
alter table vote_positions enable row level security;
create policy "public read" on vote_positions for select using (true);

create view member_votes with (security_invoker = true) as
select p.bioguide_id, p.position, v.vote_id, v.chamber, v.congress, v.voted_at, v.question,
       v.description, v.document_name, v.result, v.source_url,
       v.bill_congress, v.bill_type, v.bill_number,
       b.policy_area, coalesce(b.short_title, b.title) as bill_title
from vote_positions p
join votes v using (vote_key)
left join bills b on b.congress = v.bill_congress and b.bill_type = v.bill_type and b.number = v.bill_number;

create view vote_position_details with (security_invoker = true) as
select v.vote_id, p.bioguide_id,
       coalesce(m.official_full_name, m.first_name || ' ' || m.last_name) as name, m.last_name,
       p.position, p.position_category, p.party_at_vote, p.state_at_vote
from vote_positions p
join votes v using (vote_key)
join members m using (bioguide_id);

create or replace function refresh_member_vote_stats() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  create temporary table _pos on commit drop as
  select p.vote_key, p.bioguide_id, p.position_category, p.party_at_vote,
         v.congress, v.chamber,
         -- Only independents need the caucus lookup; everyone else is scored by party.
         case when p.party_at_vote in ('Democrat', 'Republican') then p.party_at_vote else coalesce(
           (select t.caucus from public.terms t
             where t.bioguide_id = p.bioguide_id and t.chamber = v.chamber
               and v.voted_at::date >= t.start_date and v.voted_at::date <= t.end_date
             order by t.start_date desc limit 1),
           p.party_at_vote) end as scoring_party
  from public.vote_positions p
  join public.votes v using (vote_key);

  create temporary table _split on commit drop as
  with sides as (
    select vote_key,
      count(*) filter (where party_at_vote = 'Democrat' and position_category = 'yes') as d_yes,
      count(*) filter (where party_at_vote = 'Democrat' and position_category = 'no') as d_no,
      count(*) filter (where party_at_vote = 'Republican' and position_category = 'yes') as r_yes,
      count(*) filter (where party_at_vote = 'Republican' and position_category = 'no') as r_no
    from _pos group by vote_key)
  select vote_key,
    case when d_yes > d_no then 'yes' else 'no' end as d_side,
    case when r_yes > r_no then 'yes' else 'no' end as r_side
  from sides
  where d_yes <> d_no and r_yes <> r_no
    and (d_yes > d_no) <> (r_yes > r_no);

  delete from public.member_vote_stats where true;  -- explicit WHERE: the API connection runs pg-safeupdate
  insert into public.member_vote_stats
    (bioguide_id, congress, chamber, scoring_party, roll_calls, missed, party_split_votes, with_party)
  select p.bioguide_id, p.congress, p.chamber,
    mode() within group (order by p.scoring_party),
    count(*),
    count(*) filter (where p.position_category = 'not_voting'),
    count(*) filter (where s.vote_key is not null and p.position_category in ('yes', 'no')
                       and p.scoring_party in ('Democrat', 'Republican')),
    count(*) filter (where s.vote_key is not null and p.position_category =
                       case p.scoring_party when 'Democrat' then s.d_side when 'Republican' then s.r_side end)
  from _pos p left join _split s using (vote_key)
  group by p.bioguide_id, p.congress, p.chamber;

  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function refresh_member_vote_stats() from public, anon, authenticated;
grant execute on function refresh_member_vote_stats() to service_role;

create or replace function member_agreement(a text, b text)
returns json language sql stable set search_path = '' as $$
  with pairs as (
    select v.vote_id, v.congress, v.chamber, v.voted_at, v.question, v.description, v.result, v.source_url,
           v.bill_congress, v.bill_type, v.bill_number,
           pa.position as a_position, pb.position as b_position,
           pa.position_category as a_cat, pb.position_category as b_cat
    from public.vote_positions pa
    join public.vote_positions pb on pb.vote_key = pa.vote_key and pb.bioguide_id = b
    join public.votes v on v.vote_key = pa.vote_key
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
