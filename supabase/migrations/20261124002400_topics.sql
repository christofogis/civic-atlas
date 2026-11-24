-- Topic pages: per Congress and policy area, how many bills were introduced, passed a chamber and
-- became law. Stored (refreshed by the bills job) so the topics index doesn't scan every bill.
create table topic_stats (
  congress     smallint not null,
  policy_area  text not null,
  bills        integer not null,
  passed_any   integer not null,   -- passed or agreed to in at least one chamber
  laws         integer not null,
  roll_calls   integer not null,   -- recorded votes on bills in this area
  primary key (congress, policy_area)
);
alter table topic_stats enable row level security;
create policy "public read" on topic_stats for select using (true);

create or replace function refresh_topic_stats() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.topic_stats where true;  -- explicit WHERE: pg-safeupdate
  insert into public.topic_stats (congress, policy_area, bills, passed_any, laws, roll_calls)
  select b.congress, b.policy_area, count(*),
         count(*) filter (where b.passed_house_date is not null or b.passed_senate_date is not null),
         count(*) filter (where b.became_law_date is not null),
         coalesce(sum(v.n), 0)
  from public.bills b
  left join (select bill_congress, bill_type, bill_number, count(*) n from public.votes
             where bill_type is not null group by 1, 2, 3) v
    on v.bill_congress = b.congress and v.bill_type = b.bill_type and v.bill_number = b.number
  where b.policy_area is not null
  group by b.congress, b.policy_area;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function refresh_topic_stats() from public, anon, authenticated;
grant execute on function refresh_topic_stats() to service_role;

-- Roll calls with the bill's policy area and title, for topic pages.
create view vote_list with (security_invoker = true) as
select v.vote_id, v.chamber, v.congress, v.voted_at, v.question, v.description, v.result,
       v.yea_total, v.nay_total, v.source_url, v.bill_congress, v.bill_type, v.bill_number,
       b.policy_area, coalesce(b.short_title, b.title) as bill_title
from votes v
join bills b on b.congress = v.bill_congress and b.bill_type = v.bill_type and b.number = v.bill_number;
