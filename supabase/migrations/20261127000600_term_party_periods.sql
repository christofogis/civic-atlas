-- Party changes during a term. congress-legislators lists `party_affiliations` on a term when the
-- member changed party partway through it (Manchin, Sinema, Kiley since 2023); the term's own
-- `party` is the last of them. Until now the whole term read as the later party.
--
-- Why a side table and not split terms: terms are seats. term_congresses, seat_holders (and
-- seat_holders_on), current_terms, member_directory, the address lookup, On the ballot and the
-- contact block all treat one row as one seat held from start to end, and `terms` is unique on
-- (bioguide_id, chamber, start_date). Splitting would duplicate seats in those views and give a
-- term a start date the source doesn't. The term's party stays what it is (the latest party, which
-- is what those "who holds the seat now" views want); this table says who was what, and when, for
-- anything that asks about a past date. A term without rows had one party throughout.
create table term_party_periods (
  bioguide_id      text not null,
  chamber          text not null,
  term_start_date  date not null,
  start_date       date not null,
  end_date         date not null,
  party            text not null,           -- as listed by the source
  caucus           text,                    -- independents: the party they caucus with
  updated_at       timestamptz not null default now(),
  primary key (bioguide_id, chamber, term_start_date, start_date),
  foreign key (bioguide_id, chamber, term_start_date)
    references terms (bioguide_id, chamber, start_date) on delete cascade,
  check (end_date >= start_date)
);

comment on table term_party_periods is
  'Party during part of a term, from congress-legislators party_affiliations; only terms with a party change have rows.';

create trigger term_party_periods_updated_at before update on term_party_periods
  for each row execute function set_updated_at();

alter table term_party_periods enable row level security;
create policy "public read" on term_party_periods for select using (true);

-- Cross-party bill stats: party (independents: their caucus) on the date in question, from the
-- period covering it. Where the source's periods share a day (Manchin: Democrat to May 31, 2024;
-- Independent from May 31, 2024) the later period wins, as it does for overlapping terms. A period's caucus is its own: a Democrat period has none, so it counts as
-- Democrat even if the term later lists a caucus for an independent stretch.
create or replace function party_on(p_bioguide text, p_day date) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select coalesce(p.caucus, p.party) from public.term_party_periods p
      where p.bioguide_id = p_bioguide and p_day between p.start_date and p.end_date
      order by p.start_date desc limit 1),
    (select coalesce(t.caucus, t.party) from public.terms t
      where t.bioguide_id = p_bioguide and p_day >= t.start_date and p_day <= t.end_date
      order by t.start_date desc limit 1))
$$;

-- Bill pages: the party each sponsor and cosponsor had on the day (same columns as before).
create or replace view bill_sponsor_details with (security_invoker = true) as
select b.congress, b.bill_type, b.number, b.sponsor_bioguide_id as bioguide_id,
       coalesce(m.official_full_name, m.first_name || ' ' || m.last_name) as name,
       coalesce(pp.party, t.party) as party, t.chamber, t.state, t.district
from bills b
join members m on m.bioguide_id = b.sponsor_bioguide_id
left join lateral (
  select bioguide_id, party, chamber, state, district, start_date from terms
  where bioguide_id = b.sponsor_bioguide_id and b.introduced_date between start_date and end_date
  order by start_date desc limit 1
) t on true
left join lateral (
  select p.party from term_party_periods p
  where p.bioguide_id = t.bioguide_id and p.chamber = t.chamber and p.term_start_date = t.start_date
    and b.introduced_date between p.start_date and p.end_date
  order by p.start_date desc limit 1
) pp on true;

create or replace view bill_cosponsor_details with (security_invoker = true) as
select c.congress, c.bill_type, c.number, c.bioguide_id,
       coalesce(m.official_full_name, m.first_name || ' ' || m.last_name) as name,
       m.last_name, coalesce(pp.party, t.party) as party, t.chamber, t.state, t.district,
       c.sponsored_date, c.withdrawn_date, c.is_original
from bill_cosponsors c
join members m using (bioguide_id)
join bills b using (congress, bill_type, number)
left join lateral (
  select party, chamber, state, district, start_date from terms
  where bioguide_id = c.bioguide_id
    and coalesce(c.sponsored_date, b.introduced_date) between start_date and end_date
  order by start_date desc limit 1
) t on true
left join lateral (
  select p.party from term_party_periods p
  where p.bioguide_id = c.bioguide_id and p.chamber = t.chamber and p.term_start_date = t.start_date
    and coalesce(c.sponsored_date, b.introduced_date) between p.start_date and p.end_date
  order by p.start_date desc limit 1
) pp on true;

-- Member page: each term now carries its party periods (empty when the party didn't change).
create or replace function member_page(bioguide text)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'member', (select row_to_json(m) from public.members m where m.bioguide_id = member_page.bioguide),
    'terms', coalesce((select json_agg(t order by t.start_date desc) from (
        select tt.chamber, tt.state, tt.district, tt.party, tt.start_date, tt.end_date, tt.phone, tt.address, tt.contact_form, tt.url,
          coalesce((select json_agg(json_build_object('party', p.party, 'caucus', p.caucus, 'start_date', p.start_date, 'end_date', p.end_date)
              order by p.start_date)
            from public.term_party_periods p
            where p.bioguide_id = tt.bioguide_id and p.chamber = tt.chamber and p.term_start_date = tt.start_date), '[]') as party_periods
        from public.terms tt where tt.bioguide_id = member_page.bioguide) t), '[]'),
    'seat', (select row_to_json(s) from public.seat_holders s where s.bioguide_id = member_page.bioguide limit 1),
    'memberships', coalesce((select json_agg(json_build_object('congress', cm.congress, 'title', cm.title, 'side', cm.side, 'rank', cm.rank,
        'committee', json_build_object('committee_id', c.committee_id, 'name', c.name, 'parent_id', c.parent_id, 'url', c.url)))
        from public.committee_memberships cm join public.committees c using (committee_id) where cm.bioguide_id = member_page.bioguide), '[]'),
    'finance', coalesce((select json_agg(f order by f.cycle desc) from public.finance_summaries f where f.bioguide_id = member_page.bioguide), '[]'),
    'freshness', coalesce((select json_agg(d) from public.data_freshness d), '[]'),
    'voteStats', coalesce((select json_agg(v order by v.congress desc) from public.member_vote_stats v where v.bioguide_id = member_page.bioguide), '[]'),
    'medians', coalesce((select json_agg(x) from public.chamber_vote_medians x), '[]'),
    'billStats', coalesce((select json_agg(b order by b.congress desc) from public.member_bill_stats b where b.bioguide_id = member_page.bioguide), '[]'),
    'tradeSummary', (select row_to_json(ts) from public.member_trade_summary ts where ts.bioguide_id = member_page.bioguide),
    'bySize', coalesce((select json_agg(z) from public.finance_by_size z where z.bioguide_id = member_page.bioguide), '[]'),
    'laws', coalesce((select json_agg(json_build_object('congress', l.congress, 'bill_type', l.bill_type, 'number', l.number))
        from public.bills l where l.sponsor_bioguide_id = member_page.bioguide and l.became_law_date is not null), '[]'),
    'candidacies', coalesce((select json_agg(json_build_object('fec_candidate_id', k.fec_candidate_id, 'election_year', k.election_year,
        'office', k.office, 'state', k.state, 'district', k.district)) from public.candidates k where k.bioguide_id = member_page.bioguide), '[]')
  );
$$;
grant execute on function member_page(text) to anon, authenticated;
