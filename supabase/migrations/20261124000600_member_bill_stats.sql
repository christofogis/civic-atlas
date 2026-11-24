-- Bipartisan cosponsorship per member, per Congress and chamber. Definitions (on /methods):
--   * Party is the member's party (independents: their caucus) on the relevant date:
--     the bill's introduction for the sponsor, the cosponsorship date for a cosponsor.
--   * Cross-party cosponsorship rate: of the bills a member cosponsored (not withdrawn),
--     the share introduced by a member of the other party.
--   * Cross-party support rate: of the bills a member introduced, the share with at least
--     one active cosponsor from the other party.
--   Only Democrat/Republican pairs count; chamber is the bill's chamber.

create or replace function party_on(p_bioguide text, p_day date) returns text
language sql stable set search_path = '' as $$
  select coalesce(t.caucus, t.party) from public.terms t
  where t.bioguide_id = p_bioguide and p_day >= t.start_date and p_day <= t.end_date
  order by t.start_date desc limit 1
$$;

create table member_bill_stats (
  bioguide_id               text not null references members on delete cascade,
  congress                  smallint not null references congresses,
  chamber                   text not null check (chamber in ('house', 'senate')),
  cosponsored               integer not null default 0,  -- with both parties known
  cosponsored_other_party   integer not null default 0,
  sponsored                 integer not null default 0,
  sponsored_with_other_party integer not null default 0,
  computed_at               timestamptz not null default now(),
  primary key (bioguide_id, congress, chamber)
);

alter table member_bill_stats enable row level security;
create policy "public read" on member_bill_stats for select using (true);

create view chamber_bill_medians with (security_invoker = true) as
select congress, chamber,
  percentile_cont(0.5) within group (order by cosponsored_other_party::numeric / cosponsored)
    filter (where cosponsored >= 20) as median_cross_party_cosponsor_rate,
  percentile_cont(0.5) within group (order by sponsored_with_other_party::numeric / sponsored)
    filter (where sponsored >= 10) as median_cross_party_support_rate
from member_bill_stats
group by congress, chamber;

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

  delete from public.member_bill_stats;
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

revoke all on function refresh_member_bill_stats() from public, anon, authenticated;
grant execute on function refresh_member_bill_stats() to service_role;
