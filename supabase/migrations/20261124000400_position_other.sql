-- Some roll calls aren't yes/no. In the election of the Speaker, each member's recorded
-- vote is a candidate's name ("Jeffries", "Johnson"). Those keep the clerk's wording in
-- `position` and count as 'other'.
alter table vote_positions drop constraint vote_positions_position_category_check;
alter table vote_positions add constraint vote_positions_position_category_check
  check (position_category in ('yes', 'no', 'present', 'not_voting', 'other'));
