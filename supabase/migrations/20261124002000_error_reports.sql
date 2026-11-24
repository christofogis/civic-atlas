-- "Report an error" submissions. Visitors can add a report through submit_error_report() but
-- can't read any; Chris reads them in the Supabase dashboard. No names or contact details are
-- asked for. A global limit of 30 reports an hour caps spam without needing accounts.
create table error_reports (
  id          bigint generated always as identity primary key,
  page        text not null check (length(page) between 1 and 300),
  message     text not null check (length(message) between 5 and 2000),
  created_at  timestamptz not null default now(),
  status      text not null default 'new' check (status in ('new', 'fixed', 'not_an_error', 'duplicate'))
);
create index error_reports_created_idx on error_reports (created_at desc);
alter table error_reports enable row level security;   -- no policies: no direct access via the API

create or replace function submit_error_report(page text, message text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.error_reports where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many reports right now. Please try again later.';
  end if;
  insert into public.error_reports (page, message) values (left(trim(page), 300), left(trim(message), 2000));
  return true;
end;
$$;
revoke all on function submit_error_report(text, text) from public;
grant execute on function submit_error_report(text, text) to anon, authenticated;
