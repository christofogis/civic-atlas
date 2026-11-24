-- Civic Atlas — core federal schema (Milestone 1)
--
-- Design rules:
--   * Members are keyed on bioguide_id (the official Congress identifier).
--   * Anything that changes between Congresses (districts, votes, committee seats)
--     carries a `congress` number. Terms carry start/end dates instead, because a
--     Senate term spans three Congresses; `term_congresses` maps them.
--   * Party is recorded where it was true at the time: on the term and on each vote
--     position, so a later party switch never rewrites history.
--   * Every row that came from an outside source keeps a `source_url`.
--   * The browser can only read. Ingest jobs write with the service-role key,
--     which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Congresses
-- ---------------------------------------------------------------------------

create table congresses (
  number      smallint primary key check (number > 0),
  start_date  date not null,
  end_date    date not null,
  check (end_date > start_date)
);

comment on table congresses is 'One row per two-year Congress (e.g. 120 = 2027-2029).';

-- ---------------------------------------------------------------------------
-- Members and terms (source: unitedstates/congress-legislators)
-- ---------------------------------------------------------------------------

create table members (
  bioguide_id         text primary key check (bioguide_id ~ '^[A-Z][0-9]{6}$'),
  lis_id              text unique,     -- Senate roll-call XML identifies senators by this
  govtrack_id         integer unique,
  thomas_id           text,
  icpsr_id            integer,
  wikidata_id         text,
  fec_candidate_ids   text[] not null default '{}',
  first_name          text not null,
  middle_name         text,
  last_name           text not null,
  suffix              text,
  nickname            text,
  official_full_name  text,
  birthday            date,
  gender              text check (gender in ('M', 'F')),
  source_url          text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index members_last_name_idx on members (lower(last_name));
create index members_fec_ids_idx on members using gin (fec_candidate_ids);

comment on table members is 'Everyone who has served in Congress, keyed on bioguide_id.';

create table terms (
  id            bigint generated always as identity primary key,
  bioguide_id   text not null references members on delete cascade,
  chamber       text not null check (chamber in ('house', 'senate')),
  state         char(2) not null,
  district      smallint,              -- House only; 0 = at-large
  senate_class  smallint check (senate_class in (1, 2, 3)),
  state_rank    text check (state_rank in ('senior', 'junior')),
  party         text not null,         -- as listed for the term
  start_date    date not null,
  end_date      date not null,
  how           text,                  -- e.g. 'appointment', 'special-election'
  url           text,                  -- official website for the term
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_date > start_date),
  check ((chamber = 'house'  and district is not null and senate_class is null)
      or (chamber = 'senate' and district is null)),
  unique (bioguide_id, chamber, start_date)
);

create index terms_lookup_idx on terms (chamber, state, district, start_date, end_date);
create index terms_member_idx on terms (bioguide_id, start_date desc);

comment on table terms is 'Each term served. Senate terms span three Congresses; see term_congresses.';

-- Which Congresses each term overlaps.
create view term_congresses with (security_invoker = true) as
select t.id as term_id, t.bioguide_id, c.number as congress
from terms t
join congresses c
  on t.start_date < c.end_date and t.end_date > c.start_date;

-- Members serving today. Drives the address lookup result.
create view current_terms with (security_invoker = true) as
select t.*
from terms t
where current_date >= t.start_date and current_date < t.end_date;

-- ---------------------------------------------------------------------------
-- Districts
-- ---------------------------------------------------------------------------

-- The list of seats per Congress. Boundaries are not stored: Geocodio maps an
-- address to (congress, state, district) at lookup time. User addresses are not stored.
create table districts (
  congress  smallint not null references congresses,
  state     char(2) not null,
  district  smallint not null check (district >= 0),   -- 0 = at-large
  primary key (congress, state, district)
);

comment on table districts is 'House seats per Congress. Changes when states redistrict.';

-- ---------------------------------------------------------------------------
-- Committees (source: congress-legislators committees-current / membership)
-- ---------------------------------------------------------------------------

create table committees (
  committee_id  text primary key,        -- e.g. 'HSAG', subcommittee 'HSAG15'
  parent_id     text references committees,
  chamber       text not null check (chamber in ('house', 'senate', 'joint')),
  name          text not null,
  url           text,
  source_url    text not null,
  updated_at    timestamptz not null default now()
);

create table committee_memberships (
  congress      smallint not null references congresses,
  committee_id  text not null references committees on delete cascade,
  bioguide_id   text not null references members on delete cascade,
  side          text check (side in ('majority', 'minority')),
  rank          smallint,
  title         text,                    -- e.g. 'Chair', 'Ranking Member'
  primary key (congress, committee_id, bioguide_id)
);

create index committee_memberships_member_idx on committee_memberships (bioguide_id, congress);

-- ---------------------------------------------------------------------------
-- Bills (source: Congress.gov API)
-- ---------------------------------------------------------------------------

create table bills (
  congress            smallint not null references congresses,
  bill_type           text not null check (bill_type in
                        ('hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres')),
  number              integer not null check (number > 0),
  title               text not null,
  short_title         text,
  introduced_date     date,
  sponsor_bioguide_id text references members,
  policy_area         text,
  latest_action_date  date,
  latest_action_text  text,
  crs_summary         text,               -- official CRS summary, when published
  ai_summary          text,               -- labeled fallback only; never shown as official
  ai_summary_model    text,
  source_url          text not null,
  updated_at          timestamptz not null default now(),
  primary key (congress, bill_type, number),
  check (ai_summary is null or ai_summary_model is not null)
);

create index bills_sponsor_idx on bills (sponsor_bioguide_id, introduced_date desc);

create table bill_cosponsors (
  congress       smallint not null,
  bill_type      text not null,
  number         integer not null,
  bioguide_id    text not null references members on delete cascade,
  sponsored_date date,
  withdrawn_date date,
  is_original    boolean not null default false,
  primary key (congress, bill_type, number, bioguide_id),
  foreign key (congress, bill_type, number) references bills on delete cascade
);

create index bill_cosponsors_member_idx on bill_cosponsors (bioguide_id);

-- ---------------------------------------------------------------------------
-- Roll-call votes (sources: Congress.gov /house-vote or House Clerk XML; senate.gov XML)
-- ---------------------------------------------------------------------------

create table votes (
  vote_id        text generated always as
                   (chamber || '-' || congress || '-' || session || '-' || roll_number) stored
                   primary key,          -- e.g. 'house-119-1-17'
  chamber        text not null check (chamber in ('house', 'senate')),
  congress       smallint not null references congresses,
  session        smallint not null check (session between 1 and 3),
  roll_number    integer not null check (roll_number > 0),
  voted_at       timestamptz not null,
  question       text not null,          -- as worded by the clerk
  vote_type      text,                   -- e.g. 'Yea-and-Nay', 'Recorded Vote'
  result         text not null,          -- as worded by the clerk, e.g. 'Passed'
  required       text,                   -- e.g. '1/2', '3/5', '2/3'
  bill_congress  smallint,
  bill_type      text,
  bill_number    integer,
  amendment_ref  text,
  yea_total      smallint,
  nay_total      smallint,
  present_total  smallint,
  not_voting_total smallint,
  source_url     text not null,
  updated_at     timestamptz not null default now(),
  foreign key (bill_congress, bill_type, bill_number) references bills (congress, bill_type, number),
  check ((bill_type is null) = (bill_number is null))
);

create index votes_recent_idx on votes (chamber, voted_at desc);
create index votes_bill_idx on votes (bill_congress, bill_type, bill_number);

create table vote_positions (
  vote_id       text not null references votes on delete cascade,
  bioguide_id   text not null references members,
  position      text not null,           -- raw, as recorded: 'Yea', 'Aye', 'No', 'Not Voting', 'Guilty'...
  position_category text not null check (position_category in ('yes', 'no', 'present', 'not_voting')),
  party_at_vote text not null,
  state_at_vote char(2) not null,
  primary key (vote_id, bioguide_id)
);

create index vote_positions_member_idx on vote_positions (bioguide_id);

comment on column vote_positions.position is 'Exact wording from the clerk; position_category is for counting only.';

-- ---------------------------------------------------------------------------
-- Campaign finance (source: OpenFEC)
-- ---------------------------------------------------------------------------

create table finance_summaries (
  fec_candidate_id       text not null,
  cycle                  smallint not null check (cycle % 2 = 0),
  bioguide_id            text references members,
  receipts               numeric(14, 2),
  disbursements          numeric(14, 2),
  cash_on_hand           numeric(14, 2),
  debts_owed             numeric(14, 2),
  individual_contributions numeric(14, 2),
  pac_contributions      numeric(14, 2),
  party_contributions    numeric(14, 2),
  candidate_self_funding numeric(14, 2),
  coverage_end_date      date,
  source_url             text not null,
  fetched_at             timestamptz not null default now(),
  primary key (fec_candidate_id, cycle)
);

create index finance_member_idx on finance_summaries (bioguide_id, cycle desc);

comment on table finance_summaries is 'FEC totals per candidate per two-year cycle. Totals only; no contributor names.';

-- ---------------------------------------------------------------------------
-- Ingest bookkeeping (drives "data last updated" on each page)
-- ---------------------------------------------------------------------------

create table ingest_runs (
  id             bigint generated always as identity primary key,
  job            text not null,            -- e.g. 'members', 'house-votes', 'fec-summaries'
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  rows_inserted  integer not null default 0,
  rows_updated   integer not null default 0,
  rows_deleted   integer not null default 0,
  error          text
);

create index ingest_runs_job_idx on ingest_runs (job, started_at desc);

create view data_freshness with (security_invoker = true) as
select distinct on (job) job, finished_at as last_success_at
from ingest_runs
where status = 'succeeded'
order by job, finished_at desc;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger members_updated_at    before update on members    for each row execute function set_updated_at();
create trigger terms_updated_at      before update on terms      for each row execute function set_updated_at();
create trigger committees_updated_at before update on committees for each row execute function set_updated_at();
create trigger bills_updated_at      before update on bills      for each row execute function set_updated_at();
create trigger votes_updated_at      before update on votes      for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: public read, no public writes
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'congresses', 'members', 'terms', 'districts', 'committees', 'committee_memberships',
    'bills', 'bill_cosponsors', 'votes', 'vote_positions', 'finance_summaries', 'ingest_runs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

insert into congresses (number, start_date, end_date) values
  (118, '2023-01-03', '2025-01-03'),
  (119, '2025-01-03', '2027-01-03'),
  (120, '2027-01-03', '2029-01-03');
