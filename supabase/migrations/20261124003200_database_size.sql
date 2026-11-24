-- Database size in bytes, for the weekly size check (free plan limit is 500 MB).
-- Service role only; the public site doesn't need it.
create function database_size() returns bigint
language sql security definer set search_path = '' as $$
  select pg_database_size(current_database());
$$;
revoke all on function database_size() from public, anon, authenticated;
grant execute on function database_size() to service_role;
