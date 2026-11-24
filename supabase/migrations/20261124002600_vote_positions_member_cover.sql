-- Member pages read one member's ~1,600 positions, scattered across the table (it's ordered by
-- vote). Reading them from the heap took ~0.5 s cold and timed out under load. A covering index
-- lets that read come from the index alone.
create index vote_positions_member_cover_idx on vote_positions (bioguide_id, vote_key)
  include (position, position_category, party_at_vote);
drop index vote_positions_member_idx;
