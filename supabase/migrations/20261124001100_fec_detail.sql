-- Campaign-finance detail per FEC candidate ID and cycle (OpenFEC aggregates; no donor names).

-- Individual contributions by size. size_bucket is the bucket's lower bound:
-- 0 = under $200 (mostly unitemized), 200, 500, 1000, 2000 = $2,000 and over.
create table finance_by_size (
  fec_candidate_id  text not null,
  cycle             smallint not null,
  bioguide_id       text references members,
  size_bucket       integer not null,
  total             numeric(14, 2),
  contributions     integer,           -- unknown for unitemized gifts under $200
  primary key (fec_candidate_id, cycle, size_bucket)
);

-- Top employers named by individual donors (placeholders like RETIRED excluded; see /methods).
create table finance_top_employers (
  fec_candidate_id  text not null,
  cycle             smallint not null,
  bioguide_id       text references members,
  rank              smallint not null,
  employer          text not null,     -- as written by donors
  total             numeric(14, 2),
  contributions     integer,
  primary key (fec_candidate_id, cycle, rank)
);

-- Committees (PACs) giving the most, from the 100 largest contributions on Form 3 line 11C.
create table finance_committee_contributions (
  fec_candidate_id         text not null,
  cycle                    smallint not null,
  bioguide_id              text references members,
  rank                     smallint not null,
  contributor_committee_id text not null,
  contributor_name         text not null,
  total                    numeric(14, 2),
  contributions            integer,
  primary key (fec_candidate_id, cycle, rank)
);

-- Independent expenditures (Schedule E) for or against the candidate, by spender.
create table outside_spending (
  fec_candidate_id  text not null,
  cycle             smallint not null,
  bioguide_id       text references members,
  committee_id      text not null,
  committee_name    text not null,
  support_oppose    text not null check (support_oppose in ('support', 'oppose')),
  total             numeric(14, 2),
  primary key (fec_candidate_id, cycle, committee_id, support_oppose)
);

create index finance_by_size_member_idx on finance_by_size (bioguide_id, cycle);
create index finance_top_employers_member_idx on finance_top_employers (bioguide_id, cycle);
create index finance_committee_contributions_member_idx on finance_committee_contributions (bioguide_id, cycle);
create index outside_spending_member_idx on outside_spending (bioguide_id, cycle);

do $$
declare t text;
begin
  foreach t in array array['finance_by_size', 'finance_top_employers', 'finance_committee_contributions', 'outside_spending'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end;
$$;
