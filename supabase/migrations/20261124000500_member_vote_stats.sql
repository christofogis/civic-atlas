-- Party-line and attendance statistics per member, per Congress and chamber.
-- Definitions (shown on /methods):
--   * A party-split vote: a roll call where a majority of voting Democrats and a majority
--     of voting Republicans took opposite sides (yes vs. no). Votes with no yes/no choice
--     (quorum calls, the Speaker election) never count.
--   * Party-line rate: on party-split votes where the member voted yes or no, the share
--     cast with their own party's majority. Independents are compared with the party they
--     caucus with, as recorded in congress-legislators.
--   * Missed-vote rate: share of the chamber's roll calls during the member's service where
--     the clerk recorded them as not voting.

-- Independents' caucus, from congress-legislators.
alter table terms add column caucus text;

create table member_vote_stats (
  bioguide_id        text not null references members on delete cascade,
  congress           smallint not null references congresses,
  chamber            text not null check (chamber in ('house', 'senate')),
  scoring_party      text not null,       -- party (or caucus) the member is compared with
  roll_calls         integer not null,    -- roll calls with a recorded position for them
  missed             integer not null,    -- recorded as not voting
  party_split_votes  integer not null,    -- party-split votes where they voted yes or no
  with_party         integer not null,    -- of those, cast with their party's majority
  computed_at        timestamptz not null default now(),
  primary key (bioguide_id, congress, chamber)
);

alter table member_vote_stats enable row level security;
create policy "public read" on member_vote_stats for select using (true);

-- Chamber medians, for context on each member page.
create view chamber_vote_medians with (security_invoker = true) as
select congress, chamber,
  percentile_cont(0.5) within group (order by with_party::numeric / nullif(party_split_votes, 0)) as median_party_line_rate,
  percentile_cont(0.5) within group (order by missed::numeric / nullif(roll_calls, 0)) as median_missed_rate,
  count(*) as members
from member_vote_stats
where roll_calls >= 50   -- leave out members who served only briefly
group by congress, chamber;

-- Recompute everything from vote_positions. Run by the votes ingest job (service role).
create or replace function refresh_member_vote_stats() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  create temporary table _pos on commit drop as
  select p.vote_id, p.bioguide_id, p.position_category, p.party_at_vote,
         v.congress, v.chamber,
         -- Only independents need the caucus lookup; everyone else is scored by party.
         case when p.party_at_vote in ('Democrat', 'Republican') then p.party_at_vote else coalesce(
           (select t.caucus from public.terms t
             where t.bioguide_id = p.bioguide_id and t.chamber = v.chamber
               and v.voted_at::date >= t.start_date and v.voted_at::date <= t.end_date
             order by t.start_date desc limit 1),
           p.party_at_vote) end as scoring_party
  from public.vote_positions p
  join public.votes v using (vote_id);

  create temporary table _split on commit drop as
  with sides as (
    select vote_id,
      count(*) filter (where party_at_vote = 'Democrat' and position_category = 'yes') as d_yes,
      count(*) filter (where party_at_vote = 'Democrat' and position_category = 'no') as d_no,
      count(*) filter (where party_at_vote = 'Republican' and position_category = 'yes') as r_yes,
      count(*) filter (where party_at_vote = 'Republican' and position_category = 'no') as r_no
    from _pos group by vote_id)
  select vote_id,
    case when d_yes > d_no then 'yes' else 'no' end as d_side,
    case when r_yes > r_no then 'yes' else 'no' end as r_side
  from sides
  where d_yes <> d_no and r_yes <> r_no
    and (d_yes > d_no) <> (r_yes > r_no);

  delete from public.member_vote_stats;
  insert into public.member_vote_stats
    (bioguide_id, congress, chamber, scoring_party, roll_calls, missed, party_split_votes, with_party)
  select p.bioguide_id, p.congress, p.chamber,
    mode() within group (order by p.scoring_party),
    count(*),
    count(*) filter (where p.position_category = 'not_voting'),
    count(*) filter (where s.vote_id is not null and p.position_category in ('yes', 'no')
                       and p.scoring_party in ('Democrat', 'Republican')),
    count(*) filter (where s.vote_id is not null and p.position_category =
                       case p.scoring_party when 'Democrat' then s.d_side when 'Republican' then s.r_side end)
  from _pos p left join _split s using (vote_id)
  group by p.bioguide_id, p.congress, p.chamber;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function refresh_member_vote_stats() from public, anon, authenticated;
grant execute on function refresh_member_vote_stats() to service_role;
