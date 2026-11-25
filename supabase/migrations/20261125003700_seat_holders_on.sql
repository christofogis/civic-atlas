-- seat_holders as of any date, for rehearsing a Congress transition (Jan 3) before it happens.
-- Same rules as the seat_holders view, with as_of in place of current_date. The site reads the
-- view; only the automated transition check calls this with a future date.
create function seat_holders_on(as_of date)
returns table (
  term_id bigint, bioguide_id text, chamber text, state text, district smallint, senate_class smallint,
  seat_number smallint, state_rank text, party text, start_date date, end_date date, how text, url text,
  seat_status text
)
language sql stable security invoker set search_path = public as $$
  with candidates as (
    select t.*,
      case t.chamber when 'house' then t.district else t.senate_class end as seat_number,
      row_number() over (
        partition by t.chamber, t.state, case t.chamber when 'house' then t.district else t.senate_class end
        order by t.start_date desc
      ) as rn
    from terms t
    where t.start_date <= as_of and t.end_date > as_of - 30
  )
  select id, bioguide_id, chamber, state::text, district, senate_class, seat_number::smallint,
    state_rank, party, start_date, end_date, how, url,
    case when as_of < end_date then 'serving' else 'pending_update' end
  from candidates where rn = 1;
$$;
grant execute on function seat_holders_on(date) to anon, authenticated;
