-- What Congress has scheduled: House floor items for the week, Senate and House committee
-- hearings and markups, and when the Senate next convenes. Refreshed daily from the official
-- schedule feeds (docs.house.gov and senate.gov). Events more than 30 days old are removed.
create table upcoming_events (
  event_id       text primary key,          -- e.g. house-floor-20261116-409831, senate-hearing-338860
  chamber        text not null check (chamber in ('house', 'senate')),
  kind           text not null check (kind in ('floor', 'hearing', 'markup', 'meeting', 'convene')),
  event_date     date not null,             -- for House floor items: the Monday of the week
  event_time     text,                      -- as published, e.g. '10:00 AM'
  week_of        boolean not null default false,  -- true when only the week is known
  committee_id   text,                      -- committees.committee_id when it matches
  committee_name text,
  title          text not null,
  category       text,                      -- House floor: 'suspension', 'rule' or 'other'
  bill_refs      text[] not null default '{}',     -- e.g. {119-hr-7254}
  location       text,
  status         text,                      -- as published, e.g. 'Scheduled', 'Postponed'
  source_url     text not null,
  updated_at     timestamptz not null default now()
);
create index upcoming_events_date_idx on upcoming_events (event_date);
create index upcoming_events_committee_idx on upcoming_events (committee_id, event_date);
create index upcoming_events_bills_idx on upcoming_events using gin (bill_refs);
alter table upcoming_events enable row level security;
create policy "public read" on upcoming_events for select using (true);
create trigger upcoming_events_updated_at before update on upcoming_events
  for each row execute function set_updated_at();
