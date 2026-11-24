-- Every member's position on a roll call, with their name, for the breakdown on bill pages.
-- Party and state are as recorded by the clerk at the time of the vote.
create view vote_position_details with (security_invoker = true) as
select p.vote_id, p.bioguide_id,
       coalesce(m.official_full_name, m.first_name || ' ' || m.last_name) as name, m.last_name,
       p.position, p.position_category, p.party_at_vote, p.state_at_vote
from vote_positions p
join members m using (bioguide_id);
