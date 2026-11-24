-- STOCK Act Periodic Transaction Reports (PTRs) and the trades they disclose.
-- Sources: House Clerk financial disclosure index + PTR PDFs; Senate eFD.
-- Use is limited by 5 U.S.C. § 13107 (no commercial use other than news media
-- dissemination to the public; no use for credit ratings or soliciting money).

create table ptr_filings (
  filing_id          text primary key,      -- 'house-<DocID>' or 'senate-<uuid>'
  chamber            text not null check (chamber in ('house', 'senate')),
  bioguide_id        text references members,
  filer_name         text not null,         -- as listed by the clerk
  filed_date         date not null,
  format             text not null check (format in ('electronic', 'scanned')),
  is_amendment       boolean not null default false,
  transaction_count  integer not null default 0,
  source_url         text not null,
  fetched_at         timestamptz not null default now()
);

create index ptr_filings_member_idx on ptr_filings (bioguide_id, filed_date desc);

create table stock_transactions (
  filing_id          text not null references ptr_filings on delete cascade,
  row_num            smallint not null,
  bioguide_id        text references members,
  owner              text,                  -- self | spouse | joint | dependent child
  asset_name         text not null,         -- as filed
  ticker             text,
  asset_type         text,                  -- House code (e.g. ST) or Senate label (e.g. Stock)
  transaction_type   text not null,         -- purchase | sale | sale (partial) | exchange
  transaction_date   date,
  notification_date  date,                  -- House only
  amount_text        text,                  -- the range as filed
  amount_min         bigint,
  amount_max         bigint,                -- null for "Over $..." ranges
  comment            text,
  filed_date         date not null,
  days_to_file       integer generated always as (filed_date - transaction_date) stored,
  primary key (filing_id, row_num)
);

create index stock_transactions_member_idx on stock_transactions (bioguide_id, transaction_date desc);
create index stock_transactions_ticker_idx on stock_transactions (ticker);

comment on column stock_transactions.days_to_file is
  'Days from the transaction to the filing. The STOCK Act''s outer limit is 45.';

alter table ptr_filings enable row level security;
create policy "public read" on ptr_filings for select using (true);
alter table stock_transactions enable row level security;
create policy "public read" on stock_transactions for select using (true);
