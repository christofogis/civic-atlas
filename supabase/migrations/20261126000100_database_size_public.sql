-- The status page shows how much of the plan's space the database uses. The size of the database
-- is not sensitive, so the read-only browser role may call database_size().
grant execute on function database_size() to anon, authenticated;
