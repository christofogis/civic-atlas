-- Official text versions of each bill (introduced, reported, engrossed, enrolled, public law)
-- from BILLSTATUS, and a mechanical section-by-section comparison of consecutive full-text
-- versions, computed by scripts/ingest/bill-text.mjs from GPO's XML.
create table bill_text_versions (
  congress     smallint not null,
  bill_type    text not null,
  number       integer not null,
  version_code text not null,           -- GPO code: ih, rh, eh, es, enr ...; "law" for the public law
  seq          smallint not null,       -- order: dated versions, then enrolled, then law
  version_name text not null,           -- "Reported in House", verbatim from BILLSTATUS
  version_date date,
  xml_url      text not null,
  full_text    boolean,                 -- null until checked; false for amendment-only documents
  primary key (congress, bill_type, number, version_code),
  foreign key (congress, bill_type, number) references bills on delete cascade
);

create table bill_version_changes (
  congress        smallint not null,
  bill_type       text not null,
  number          integer not null,
  from_code       text not null,
  to_code         text not null,
  sections_from   integer not null,
  sections_to     integer not null,
  words_from      integer not null,
  words_to        integer not null,
  added_count     integer not null,
  removed_count   integer not null,
  changed_count   integer not null,
  unchanged_count integer not null,
  added           jsonb not null,       -- [{path, header}], at most 400 listed
  removed         jsonb not null,
  changed         jsonb not null,       -- [{path, header, words_from, words_to}]
  computed_at     timestamptz not null default now(),
  primary key (congress, bill_type, number, from_code, to_code),
  foreign key (congress, bill_type, number) references bills on delete cascade
);

alter table bill_text_versions enable row level security;
alter table bill_version_changes enable row level security;
create policy "public read" on bill_text_versions for select using (true);
create policy "public read" on bill_version_changes for select using (true);
