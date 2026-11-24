-- Committee hearings, markups and business meetings, both chambers, from the Congress.gov API.
-- Witnesses are listed for House meetings only (Senate committees publish theirs on their own
-- sites). Written by scripts/ingest/meetings.mjs.
create table committee_meetings (
  event_id          text primary key,
  congress          smallint not null,
  chamber           text not null check (chamber in ('house', 'senate')),
  meeting_at        timestamptz,
  title             text not null,
  meeting_type      text,
  status            text,
  location          text,
  committee_ids     text[] not null default '{}',
  videos            jsonb not null default '[]',
  documents         jsonb not null default '[]',
  witnesses         jsonb not null default '[]',
  statements        text[] not null default '{}',
  bill_refs         text[] not null default '{}',   -- '119-hr-1'
  nomination_refs   text[] not null default '{}',   -- 'PN806-10'
  has_transcript    boolean not null default false,
  source_url        text not null,
  updated_at_source timestamptz
);
create index committee_meetings_committees_idx on committee_meetings using gin (committee_ids);
create index committee_meetings_bills_idx on committee_meetings using gin (bill_refs);
create index committee_meetings_when_idx on committee_meetings (meeting_at desc);
alter table committee_meetings enable row level security;
create policy "public read" on committee_meetings for select using (true);
