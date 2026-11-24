-- Everyone who has filed with the FEC as a candidate for Congress in an upcoming election,
-- with their committee's latest totals. House districts are as filed (2028 races use the maps
-- for the 120th Congress). bioguide_id is set when the candidate is a current or recent member.
create table candidates (
  fec_candidate_id     text not null,
  election_year        smallint not null,
  name                 text not null,          -- as filed, e.g. 'PADILLA, ALEX'
  party                text,                   -- as filed, e.g. 'DEMOCRATIC PARTY'
  office               char(1) not null check (office in ('H', 'S')),
  state                char(2) not null,
  district             smallint,               -- House only; 0 for at-large
  incumbent_challenge  text,                   -- 'Incumbent', 'Challenger', 'Open seat'
  receipts             numeric(14, 2),
  disbursements        numeric(14, 2),
  cash_on_hand         numeric(14, 2),
  coverage_end_date    date,
  bioguide_id          text references members,
  updated_at           timestamptz not null default now(),
  primary key (fec_candidate_id, election_year)
);
create index candidates_race_idx on candidates (election_year, office, state, district);
create index candidates_member_idx on candidates (bioguide_id);
alter table candidates enable row level security;
create policy "public read" on candidates for select using (true);
create trigger candidates_updated_at before update on candidates
  for each row execute function set_updated_at();
