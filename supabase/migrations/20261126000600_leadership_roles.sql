-- Party and chamber leadership posts (Speaker, floor leaders, whips, President pro tempore,
-- conference and caucus officers), as published in unitedstates/congress-legislators
-- (`leadership_roles` on each legislator). Titles are stored verbatim. An open end_date means the
-- source lists no end; the site treats a role as current only while start_date <= today and
-- (end_date is null or end_date > today).
create table leadership_roles (
  bioguide_id  text not null references members on delete cascade,
  chamber      text not null check (chamber in ('house', 'senate')),
  title        text not null,
  start_date   date not null,
  end_date     date,
  updated_at   timestamptz not null default now(),
  primary key (bioguide_id, title, start_date)
);

create index leadership_roles_current_idx on leadership_roles (end_date, chamber);
create trigger leadership_roles_updated_at before update on leadership_roles
  for each row execute function set_updated_at();

comment on table leadership_roles is 'Leadership posts as published in unitedstates/congress-legislators; title verbatim.';

alter table leadership_roles enable row level security;
create policy "public read" on leadership_roles for select using (true);
