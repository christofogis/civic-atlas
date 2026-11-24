-- Lobbying reports (LD-2, from LDA.gov) that name a bill we track.
-- Only filings that mention at least one tracked bill are kept. When a registrant amends a
-- quarter's report for a client, the ingest job keeps only the latest version for that
-- registrant, client, year and quarter.
-- Dollar amounts are not stored: an LD-2's income or expenses cover every issue on the
-- report, so they can't be attributed to any one bill.

create table lobbying_filings (
  filing_uuid      uuid primary key,
  filing_type      text not null,            -- LDA code as filed: Q1, 1A, 1T, ...
  filing_year      smallint not null,
  filing_period    text not null,            -- first_quarter ... fourth_quarter
  registrant_id    integer not null,         -- the lobbying firm (or the organization itself)
  registrant_name  text not null,
  client_id        integer not null,         -- who the lobbying was for
  client_name      text not null,
  dt_posted        timestamptz not null,
  updated_at       timestamptz not null default now()
);

create index lobbying_filings_key_idx
  on lobbying_filings (registrant_id, client_id, filing_year, filing_period);

create table lobbying_bill_mentions (
  filing_uuid  uuid not null references lobbying_filings on delete cascade,
  congress     smallint not null,
  bill_type    text not null,
  number       integer not null,
  issue_codes  text[] not null,             -- general issue areas the bill was listed under
  primary key (filing_uuid, congress, bill_type, number),
  foreign key (congress, bill_type, number) references bills
);

create index lobbying_bill_mentions_bill_idx on lobbying_bill_mentions (congress, bill_type, number);

create trigger lobbying_filings_updated_at before update on lobbying_filings
  for each row execute function set_updated_at();

alter table lobbying_filings enable row level security;
alter table lobbying_bill_mentions enable row level security;
create policy "public read" on lobbying_filings for select using (true);
create policy "public read" on lobbying_bill_mentions for select using (true);

-- One row per bill and client: who reported lobbying on the bill, through which registrants,
-- and in which quarters.
create view bill_lobbying with (security_invoker = true) as
select m.congress, m.bill_type, m.number,
       f.client_id, min(f.client_name) as client_name,
       array_agg(distinct f.registrant_name order by f.registrant_name) as registrants,
       count(distinct (f.filing_year, f.filing_period)) as quarters,
       min(f.filing_year * 10 + case f.filing_period when 'first_quarter' then 1 when 'second_quarter' then 2
             when 'third_quarter' then 3 else 4 end) as first_quarter_key,
       max(f.filing_year * 10 + case f.filing_period when 'first_quarter' then 1 when 'second_quarter' then 2
             when 'third_quarter' then 3 else 4 end) as last_quarter_key,
       (array_agg(f.filing_uuid order by f.dt_posted desc))[1] as latest_filing_uuid
from lobbying_bill_mentions m
join lobbying_filings f using (filing_uuid)
group by m.congress, m.bill_type, m.number, f.client_id;

-- Number of distinct clients reporting lobbying on each bill (for lists and sorting).
create view bill_lobbying_counts with (security_invoker = true) as
select congress, bill_type, number, count(distinct f.client_id) as clients
from lobbying_bill_mentions m join lobbying_filings f using (filing_uuid)
group by congress, bill_type, number;
