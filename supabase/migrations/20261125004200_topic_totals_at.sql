-- Totals for a Congress as they stood on a given date: bills introduced by then, and of those,
-- how many had passed a chamber and become law by then. Lets the Topics page compare the current
-- Congress with the previous one at the same point in its two-year term. Counts bills with a
-- policy area, like topic_stats.
create or replace function topic_totals_at(c smallint, through date)
returns table (bills bigint, passed_any bigint, laws bigint)
language sql stable set search_path = '' as $$
  select count(*),
         count(*) filter (where b.passed_house_date <= through or b.passed_senate_date <= through),
         count(*) filter (where b.became_law_date <= through)
  from public.bills b
  where b.congress = c and b.policy_area is not null and b.introduced_date <= through;
$$;
grant execute on function topic_totals_at(smallint, date) to anon, authenticated;
