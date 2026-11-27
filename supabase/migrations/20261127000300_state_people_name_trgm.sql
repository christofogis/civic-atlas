-- Search suggestions find state officials by part of a name ("padil"). A trigram index lets
-- name ILIKE '%...%' use an index instead of scanning all ~7,600 people (about 1.7 s before).
create extension if not exists pg_trgm with schema extensions;
create index if not exists state_people_name_trgm on state_people using gin (name extensions.gin_trgm_ops) where active;
-- Bills whose short title starts with what's typed ("farm" -> Farm, Food, and National Security
-- Act), for ranking suggestions: a prefix ILIKE on short_title, 2.6 s scan before, ~2 ms now.
create index if not exists bills_short_title_trgm on bills using gin (short_title extensions.gin_trgm_ops);
