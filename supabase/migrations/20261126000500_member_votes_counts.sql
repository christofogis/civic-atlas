-- The plain vote sentences ("It passed, 218-214") need each vote's totals, the required majority as
-- recorded, and the amendment reference. New columns go at the end so the view can be replaced in place.
create or replace view member_votes with (security_invoker = true) as
select p.bioguide_id, p.position, v.vote_id, v.chamber, v.congress, v.voted_at, v.question,
       v.description, v.document_name, v.result, v.source_url,
       v.bill_congress, v.bill_type, v.bill_number,
       b.policy_area, coalesce(b.short_title, b.title) as bill_title,
       v.yea_total, v.nay_total, v.present_total, v.not_voting_total, v.required, v.amendment_ref
from vote_positions p
join votes v using (vote_key)
left join bills b on b.congress = v.bill_congress and b.bill_type = v.bill_type and b.number = v.bill_number;
