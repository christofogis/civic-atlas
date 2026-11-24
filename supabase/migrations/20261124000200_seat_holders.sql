-- Who holds each seat, robust to the gap between a term ending and the source data
-- catching up (e.g. Jan 3 swearing-in, resignations, special elections).
--
-- A seat is (chamber, state, district) for the House and (chamber, state, senate_class)
-- for the Senate. For each seat we take the most recent term that has started and that
-- either covers today or ended within the last 30 days.
--
--   seat_status = 'serving'         term covers today
--   seat_status = 'pending_update'  term has ended; the next holder isn't in the data yet
--
-- A seat with no qualifying term is not returned (vacant, or data missing).
-- The UI must never present a 'pending_update' holder as the current representative:
-- after redistricting, the previous holder may have represented a different area.

create view seat_holders with (security_invoker = true) as
with candidates as (
  select
    t.*,
    case t.chamber when 'house' then t.district else t.senate_class end as seat_number,
    row_number() over (
      partition by t.chamber, t.state,
                   case t.chamber when 'house' then t.district else t.senate_class end
      order by t.start_date desc
    ) as rn
  from terms t
  where t.start_date <= current_date
    and t.end_date > current_date - 30
)
select
  id as term_id, bioguide_id, chamber, state, district, senate_class, seat_number,
  state_rank, party, start_date, end_date, how, url,
  case when current_date < end_date then 'serving' else 'pending_update' end as seat_status
from candidates
where rn = 1;

comment on view seat_holders is
  'Most recent holder per seat. pending_update = term ended, successor not yet in source data.';
