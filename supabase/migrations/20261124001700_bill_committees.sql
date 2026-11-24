-- Committees (and subcommittees) each bill was referred to, from GovInfo Bill Status.
-- Only committees in today's committee list are kept; referrals to renamed or disbanded
-- committees are skipped and logged by the ingest job.
create table bill_committees (
  congress            smallint not null,
  bill_type           text not null,
  number              integer not null,
  committee_id        text not null references committees,
  first_activity_date date,
  activities          text[] not null default '{}',   -- e.g. {"Referred to","Markup by"}
  primary key (congress, bill_type, number, committee_id),
  foreign key (congress, bill_type, number) references bills
);
create index bill_committees_committee_idx on bill_committees (committee_id, congress);
alter table bill_committees enable row level security;
create policy "public read" on bill_committees for select using (true);

-- Bills referred to a committee, with sponsor and lobbying count, for committee pages.
create view committee_bills with (security_invoker = true) as
select c.committee_id, c.first_activity_date, c.activities, l.*
from bill_committees c
join bill_list l using (congress, bill_type, number);
