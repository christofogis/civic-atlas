-- The per-bill lobbying lists were views computed on every page view. For the most-lobbied bills
-- (H.R. 1: ~9,600 report mentions) they ran past the 3-second limit for public reads, so the bill
-- page failed. Store them, refreshed by the lobbying job with the totals (as bill_lobbying_totals
-- already is). The views stay for reference; the site reads the tables.
create table bill_lobbying_clients (
  congress            smallint not null,
  bill_type           text not null,
  number              integer not null,
  client_id           bigint not null,
  client_name         text,
  registrants         text[],
  quarters            integer,
  first_quarter_key   integer,
  last_quarter_key    integer,
  latest_filing_uuid  uuid,
  primary key (congress, bill_type, number, client_id)
);
create index bill_lobbying_clients_order_idx on bill_lobbying_clients (congress, bill_type, number, quarters desc, client_name);
alter table bill_lobbying_clients enable row level security;
create policy "public read" on bill_lobbying_clients for select using (true);

create table bill_lobbying_former (
  congress            smallint not null,
  bill_type           text not null,
  number              integer not null,
  lobbyist_name       text not null,
  covered_position    text not null,
  clients             text[],
  last_quarter_key    integer,
  latest_filing_uuid  uuid
);
create index bill_lobbying_former_bill_idx on bill_lobbying_former (congress, bill_type, number, lobbyist_name);
alter table bill_lobbying_former enable row level security;
create policy "public read" on bill_lobbying_former for select using (true);

create or replace function refresh_bill_lobbying_totals() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.bill_lobbying_totals where true;  -- explicit WHERE: pg-safeupdate
  insert into public.bill_lobbying_totals (congress, bill_type, number, clients)
  select m.congress, m.bill_type, m.number, count(distinct f.client_id)
  from public.lobbying_bill_mentions m join public.lobbying_filings f using (filing_uuid)
  group by 1, 2, 3;
  get diagnostics n = row_count;

  delete from public.bill_lobbying_clients where true;
  insert into public.bill_lobbying_clients select * from public.bill_lobbying;

  delete from public.bill_lobbying_former where true;
  insert into public.bill_lobbying_former select * from public.bill_lobbying_former_officials;
  return n;
end;
$$;
revoke all on function refresh_bill_lobbying_totals() from public, anon, authenticated;
grant execute on function refresh_bill_lobbying_totals() to service_role;
