-- Ingest jobs (service_role) recompute statistics over the full vote and cosponsor tables,
-- which takes longer than the 8s limit inherited from the API's connection role. Give only
-- the ingest role more time; public (anon) and signed-in limits are unchanged.
alter role service_role set statement_timeout = '120s';
notify pgrst, 'reload config';
