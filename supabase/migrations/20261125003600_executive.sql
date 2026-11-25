-- Presidents and vice presidents (unitedstates/congress-legislators executive.yaml, public domain)
-- and executive orders (Federal Register API, no key). Written by scripts/ingest/executive.mjs.
create table executive_terms (
  person_key  text not null,            -- bioguide ID when there is one, otherwise the name
  name        text not null,
  type        text not null check (type in ('prez', 'viceprez')),
  start_date  date not null,
  end_date    date,
  party       text,
  bioguide_id text,
  primary key (person_key, type, start_date)
);

create table executive_orders (
  document_number  text primary key,    -- Federal Register document number
  eo_number        integer,
  title            text not null,
  signing_date     date,
  publication_date date,
  president        text,
  citation         text,                -- e.g. "90 FR 8237"
  html_url         text not null,
  pdf_url          text
);
create index executive_orders_signed_idx on executive_orders (signing_date desc);

alter table executive_terms enable row level security;
alter table executive_orders enable row level security;
create policy "public read" on executive_terms for select using (true);
create policy "public read" on executive_orders for select using (true);
