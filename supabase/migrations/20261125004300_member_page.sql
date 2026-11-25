-- Everything the top of a member page needs, in one request (it was 13). On a slow phone each
-- request costs a round trip, and the page's summary waited on the last of them. Same rows and
-- columns as the separate reads; runs as the caller, so table policies still apply.
create or replace function member_page(bioguide text)
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'member', (select row_to_json(m) from public.members m where m.bioguide_id = member_page.bioguide),
    'terms', coalesce((select json_agg(t order by t.start_date desc) from (
        select chamber, state, district, party, start_date, end_date, phone, address, contact_form, url
        from public.terms where bioguide_id = member_page.bioguide) t), '[]'),
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
