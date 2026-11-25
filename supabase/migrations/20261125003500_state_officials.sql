-- State legislators and statewide elected officials, from the openstates/people repository
-- (public domain). Written by scripts/ingest/state-people.mjs. Party is stored as published
-- ("Democratic-Farmer-Labor", "Republican/Conservative"); the badge letter is derived in the app.
create table state_people (
  id           text primary key,                 -- ocd-person/<uuid>
  state        text not null,                    -- USPS code
  name         text not null,
  given_name   text,
  family_name  text,
  party        text,                             -- current party as published
  email        text,
  offices      jsonb not null default '[]',
  links        jsonb not null default '[]',
  sources      jsonb not null default '[]',
  active       boolean not null default true,    -- false once the person leaves the source's current files
  updated_at   timestamptz not null default now()
);
create index state_people_state_idx on state_people (state);

create table state_roles (
  person_id    text not null references state_people (id) on delete cascade,
  role_key     text not null,                    -- type|district|start_date
  state        text not null,
  type         text not null,                    -- upper, lower, legislature, governor, lt_governor, ...
  district     text,                             -- as published: '39', '3rd Suffolk', 'Windsor-3-2'
  district_key text,                             -- normalized for matching Geocodio's OCD IDs
  start_date   date,
  end_date     date,
  primary key (person_id, role_key)
);
create index state_roles_lookup_idx on state_roles (state, type, district_key);

-- Who holds each office today.
create view state_officeholders with (security_invoker = true) as
select p.id, p.state, p.name, p.party, r.type, r.district, r.district_key, r.start_date, r.end_date
from state_roles r join state_people p on p.id = r.person_id
where p.active
  and (r.start_date is null or r.start_date <= current_date)
  and (r.end_date is null or r.end_date >= current_date);

alter table state_people enable row level security;
alter table state_roles enable row level security;
create policy "public read" on state_people for select using (true);
create policy "public read" on state_roles for select using (true);
