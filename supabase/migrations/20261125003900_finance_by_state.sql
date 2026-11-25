-- Itemized individual contributions by donor's state, per FEC candidate ID and cycle (OpenFEC
-- /schedules/schedule_a/by_state/by_candidate/). Itemized means contributions over $200 in the
-- cycle; smaller gifts aren't reported by state. Written by scripts/ingest/fec-detail.mjs.
create table finance_by_state (
  fec_candidate_id  text not null,
  cycle             smallint not null,
  bioguide_id       text references members,
  state             text not null,       -- donor's state as reported
  total             numeric(14, 2),
  contributions     integer,
  primary key (fec_candidate_id, cycle, state)
);
create index finance_by_state_member_idx on finance_by_state (bioguide_id, cycle);
alter table finance_by_state enable row level security;
create policy "public read" on finance_by_state for select using (true);
