-- Lobbyists on an LD-2 activity that names a tracked bill and who disclosed a "covered"
-- government position (LDA requires listing executive or legislative branch jobs held in the
-- past 20 years). Name and position are stored as filed; we don't match them to members.
create table lobbying_covered_positions (
  filing_uuid       uuid not null references lobbying_filings on delete cascade,
  congress          smallint not null,
  bill_type         text not null,
  number            integer not null,
  lobbyist_name     text not null,
  covered_position  text not null,
  primary key (filing_uuid, congress, bill_type, number, lobbyist_name),
  foreign key (congress, bill_type, number) references bills
);
create index lobbying_covered_positions_bill_idx on lobbying_covered_positions (congress, bill_type, number);
alter table lobbying_covered_positions enable row level security;
create policy "public read" on lobbying_covered_positions for select using (true);

-- One row per bill, lobbyist and disclosed position, with the clients and latest quarter.
create view bill_lobbying_former_officials with (security_invoker = true) as
select c.congress, c.bill_type, c.number, c.lobbyist_name, c.covered_position,
       array_agg(distinct f.client_name order by f.client_name) as clients,
       max(f.filing_year * 10 + case f.filing_period when 'first_quarter' then 1 when 'second_quarter' then 2
             when 'third_quarter' then 3 else 4 end) as last_quarter_key,
       (array_agg(f.filing_uuid order by f.dt_posted desc))[1] as latest_filing_uuid
from lobbying_covered_positions c
join lobbying_filings f using (filing_uuid)
group by c.congress, c.bill_type, c.number, c.lobbyist_name, c.covered_position;
