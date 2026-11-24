-- The API connection loads pg-safeupdate, which refuses DELETE without WHERE.
-- Same functions as before, with an explicit WHERE on the table reset.

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

  delete from public.member_vote_stats where true;  -- explicit WHERE: the API connection runs pg-safeupdate
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

create or replace function refresh_member_bill_stats() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  create temporary table _b on commit drop as
  select congress, bill_type, number, sponsor_bioguide_id, introduced_date,
         case when bill_type like 'h%' then 'house' else 'senate' end as chamber,
         public.party_on(sponsor_bioguide_id, introduced_date) as sp
  from public.bills where sponsor_bioguide_id is not null;

  create temporary table _c on commit drop as
  select c.bioguide_id, b.congress, b.bill_type, b.number, b.chamber, b.sp, b.sponsor_bioguide_id,
         public.party_on(c.bioguide_id, coalesce(c.sponsored_date, b.introduced_date)) as cp
  from public.bill_cosponsors c
  join _b b using (congress, bill_type, number)
  where c.withdrawn_date is null;

  -- One pass to flag bills with at least one cosponsor from the sponsor's other party.
  create temporary table _cross on commit drop as
  select congress, bill_type, number
  from _c
  where cp in ('Democrat', 'Republican') and sp in ('Democrat', 'Republican') and cp <> sp
  group by 1, 2, 3;

  delete from public.member_bill_stats where true;  -- explicit WHERE: the API connection runs pg-safeupdate
  insert into public.member_bill_stats
    (bioguide_id, congress, chamber, cosponsored, cosponsored_other_party, sponsored, sponsored_with_other_party)
  select coalesce(co.bioguide_id, sp.bioguide_id), coalesce(co.congress, sp.congress), coalesce(co.chamber, sp.chamber),
         coalesce(co.cosponsored, 0), coalesce(co.other, 0), coalesce(sp.sponsored, 0), coalesce(sp.with_other, 0)
  from (
    select bioguide_id, congress, chamber,
      count(*) filter (where cp in ('Democrat', 'Republican') and sp in ('Democrat', 'Republican')) as cosponsored,
      count(*) filter (where cp in ('Democrat', 'Republican') and sp in ('Democrat', 'Republican') and cp <> sp) as other
    from _c group by 1, 2, 3
  ) co
  full outer join (
    select b.sponsor_bioguide_id as bioguide_id, b.congress, b.chamber,
      count(*) as sponsored,
      count(x.number) as with_other
    from _b b left join _cross x using (congress, bill_type, number)
    where b.sp in ('Democrat', 'Republican') group by 1, 2, 3
  ) sp using (bioguide_id, congress, chamber);

  get diagnostics n = row_count;
  return n;
end;
$$;
