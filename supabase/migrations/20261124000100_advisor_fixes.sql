-- Fixes from Supabase advisors after the core schema was applied.

-- Security (lint 0011): pin search_path so the trigger function can't be redirected.
alter function public.set_updated_at() set search_path = '';

-- Performance (lint 0001): cover foreign keys used in joins and cascades.
create index committee_memberships_committee_idx on committee_memberships (committee_id);
create index committees_parent_idx on committees (parent_id);
create index votes_congress_idx on votes (congress, chamber, session, roll_number);
