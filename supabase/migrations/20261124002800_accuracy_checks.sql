-- Weekly automated accuracy check: random facts on the site compared with the original
-- sources. Results are public (shown on the methods page).
create table accuracy_checks (
  id          bigint generated always as identity primary key,
  checked_at  timestamptz not null default now(),
  checked     integer not null,
  matched     integer not null,
  details     jsonb not null      -- [{area, fact, ours, source, ok, url}]
);
alter table accuracy_checks enable row level security;
create policy "public read" on accuracy_checks for select using (true);
