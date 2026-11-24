-- A member's roll-call votes with the bill each vote was on and that bill's policy area
-- (the Library of Congress's single subject term for the bill), for searching votes by issue.
-- Nominations and procedural votes with no bill have no policy area.

create view member_votes with (security_invoker = true) as
select p.bioguide_id, p.position, v.vote_id, v.chamber, v.congress, v.voted_at, v.question,
       v.description, v.document_name, v.result, v.source_url,
       v.bill_congress, v.bill_type, v.bill_number,
       b.policy_area, coalesce(b.short_title, b.title) as bill_title
from vote_positions p
join votes v using (vote_id)
left join bills b on b.congress = v.bill_congress and b.bill_type = v.bill_type and b.number = v.bill_number;
