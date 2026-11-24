-- Senate nominations with recorded votes: one row per nomination (document PN...), with the
-- nominee and position as the Senate describes them, the cloture vote if any, and the
-- confirmation vote if any. Nominations confirmed by voice vote or unanimous consent, or en bloc
-- by resolution, have no row here.
create view nominations with (security_invoker = true) as
with v as (
  select vote_id, congress, voted_at, question, description, document_name, result, yea_total, nay_total, source_url,
         regexp_replace(description, '^[^:]*:\s*', '') as what,
         case when question ~ '^On the Nomination' then 'confirmation'
              when question ~ '^On the Cloture Motion' then 'cloture' else 'other' end as step
  from votes
  where chamber = 'senate' and document_name ~ '^PN'
)
select congress, document_name,
       -- "Andrea Lucas, of Virginia, to be a Member of ..." -> nominee "Andrea Lucas", position "a Member of ..."
       regexp_replace(split_part(coalesce(max(what) filter (where step = 'confirmation'), max(what)), ' to be ', 1), ',\s*of\s+[^,]+,?\s*$', '') as nominee,
       substring(coalesce(max(what) filter (where step = 'confirmation'), max(what)) from ' to be (.*)$') as position,
       max(vote_id) filter (where step = 'cloture') as cloture_vote_id,
       max(voted_at) filter (where step = 'cloture') as cloture_at,
       max(result) filter (where step = 'cloture') as cloture_result,
       max(vote_id) filter (where step = 'confirmation') as confirmation_vote_id,
       max(voted_at) filter (where step = 'confirmation') as confirmation_at,
       max(result) filter (where step = 'confirmation') as confirmation_result,
       max(yea_total) filter (where step = 'confirmation') as yeas,
       max(nay_total) filter (where step = 'confirmation') as nays,
       max(source_url) filter (where step = 'confirmation') as confirmation_url,
       max(voted_at) as last_vote_at
from v
where step in ('confirmation', 'cloture')
group by congress, document_name;
