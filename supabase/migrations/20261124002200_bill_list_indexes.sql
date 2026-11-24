-- The site check found /bills and /week timing out: every filter on bills was a full scan of a
-- wide table (summaries are stored inline). Index each way the pages filter and sort.
create index bills_congress_action_idx on bills (congress, latest_action_date desc nulls last, number);
create index bills_congress_introduced_idx on bills (congress, introduced_date desc nulls last, number);
create index bills_congress_policy_action_idx on bills (congress, policy_area, latest_action_date desc nulls last);
create index bills_passed_house_idx on bills (passed_house_date) where passed_house_date is not null;
create index bills_passed_senate_idx on bills (passed_senate_date) where passed_senate_date is not null;
create index bills_vetoed_idx on bills (vetoed_date) where vetoed_date is not null;
create index bill_lobbying_totals_congress_clients_idx on bill_lobbying_totals (congress, clients desc);
drop index if exists bills_latest_action_idx;   -- superseded by bills_congress_action_idx

-- Bills that at least one lobbying report names, sorted by how many organizations: starts from
-- the small totals table so "most lobbying" doesn't sort every bill.
create view bill_list_lobbied with (security_invoker = true) as
select b.congress, b.bill_type, b.number, b.title, b.short_title, b.introduced_date,
       b.latest_action_date, b.latest_action_text, b.policy_area,
       s.bioguide_id as sponsor_bioguide_id, s.name as sponsor_name, s.party as sponsor_party,
       s.chamber as sponsor_chamber, s.state as sponsor_state, s.district as sponsor_district,
       l.clients as lobbying_clients
from bill_lobbying_totals l
join bills b using (congress, bill_type, number)
left join bill_sponsor_details s using (congress, bill_type, number);
