-- Search suggestions find state officials by part of a name ("padil"). A trigram index lets
-- name ILIKE '%...%' use an index instead of scanning all ~7,600 people (about 1.7 s before).
create extension if not exists pg_trgm with schema extensions;
create index if not exists state_people_name_trgm on state_people using gin (name extensions.gin_trgm_ops) where active;
