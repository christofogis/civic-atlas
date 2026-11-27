-- Optional accounts (Chris, Nov 27, 2026): sign in with Google or an email link to save officials
-- and bills across devices and to choose which emails to get. The site works fully without one.
--
-- What an account stores, and nothing more:
--   * Supabase Auth's own record (auth.users): email address, sign-in times, Google identity if used.
--   * account_prefs: email choices (all off until the person turns one on), email language, the
--     state for election reminders, and optionally the saved district numbers (the same link
--     parameters the site keeps on the device: state and district numbers, never an address).
--   * followed_officials / followed_bills: IDs the person chose to save.
--   * email_consent_events: when each email choice was turned on or off, and from where.
-- No address is ever stored. Every row belongs to one auth user and is deleted with that user
-- (on delete cascade), which delete_my_account() does on request.
--
-- Access: Row Level Security on every table. A signed-in person reads and writes only their own
-- rows; anonymous visitors get nothing. A later email job (not built yet) reads with the
-- service-role key and sends only to people who opted in.

-- ---------------------------------------------------------------------------
-- Preferences: one row per account, created by a trigger when the account is created.
-- ---------------------------------------------------------------------------
create table account_prefs (
  user_id                    uuid primary key references auth.users on delete cascade,
  language                   text not null default 'en' check (language in ('en', 'es')),
  weekly_digest              boolean not null default false,   -- weekly votes of my officials
  bill_updates               boolean not null default false,   -- actions on followed bills
  election_reminders         boolean not null default false,   -- dates for my state's elections
  election_state             text check (election_state ~ '^[A-Z]{2}$'),
  -- Saved districts as link parameters (st=CA&cg=119&cd=45...), checked by the site before use.
  -- District numbers only; the format leaves no room for a street address.
  districts                  text check (length(districts) <= 300 and districts ~ '^[A-Za-z0-9=&,.+%-]*$'),
  -- Opaque token for one-click unsubscribe links in emails (no sign-in needed to stop emails).
  unsubscribe_token          uuid not null default gen_random_uuid() unique,
  weekly_digest_changed_at      timestamptz,
  bill_updates_changed_at       timestamptz,
  election_reminders_changed_at timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- Consent record: every change to an email choice, with its time and where it was made.
create table email_consent_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('weekly_digest', 'bill_updates', 'election_reminders')),
  opted_in   boolean not null,
  source     text not null check (source in ('account_page', 'unsubscribe_link')),
  at         timestamptz not null default now()
);
create index email_consent_events_user_idx on email_consent_events (user_id, at desc);

create table followed_officials (
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  kind         text not null check (kind in ('member', 'state')),
  official_id  text not null check (
                 (kind = 'member' and official_id ~ '^[A-Z][0-9]{6}$') or
                 (kind = 'state'  and official_id ~ '^ocd-person/[0-9a-f-]{36}$')),
  created_at   timestamptz not null default now(),
  primary key (user_id, kind, official_id)
);

create table followed_bills (
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  congress    smallint not null check (congress between 93 and 200),
  bill_type   text not null check (bill_type in ('hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres')),
  number      integer not null check (number between 1 and 99999),
  created_at  timestamptz not null default now(),
  primary key (user_id, congress, bill_type, number)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- A preferences row for every new account, everything off. Email language starts as the site
-- language the person signed up in (sent by the email sign-in form), English otherwise.
create or replace function public.create_account_prefs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_prefs (user_id, language)
    values (new.id, case when new.raw_user_meta_data->>'lang' = 'es' then 'es' else 'en' end)
    on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.create_account_prefs() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_account_prefs();

-- Stamp and log each change to an email choice. The source is 'account_page' unless the
-- unsubscribe function says otherwise for its own transaction.
create or replace function public.log_email_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  src text := coalesce(nullif(current_setting('civic_atlas.consent_source', true), ''), 'account_page');
begin
  new.updated_at := now();
  if new.weekly_digest is distinct from old.weekly_digest then
    new.weekly_digest_changed_at := now();
    insert into public.email_consent_events (user_id, kind, opted_in, source) values (new.user_id, 'weekly_digest', new.weekly_digest, src);
  end if;
  if new.bill_updates is distinct from old.bill_updates then
    new.bill_updates_changed_at := now();
    insert into public.email_consent_events (user_id, kind, opted_in, source) values (new.user_id, 'bill_updates', new.bill_updates, src);
  end if;
  if new.election_reminders is distinct from old.election_reminders then
    new.election_reminders_changed_at := now();
    insert into public.email_consent_events (user_id, kind, opted_in, source) values (new.user_id, 'election_reminders', new.election_reminders, src);
  end if;
  return new;
end;
$$;
revoke all on function public.log_email_consent() from public, anon, authenticated;
create trigger account_prefs_consent before update on account_prefs
  for each row execute function public.log_email_consent();

-- A cap on saved items, so one account can't fill the database.
create or replace function public.limit_follows() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_table_name = 'followed_officials' and (select count(*) from public.followed_officials where user_id = new.user_id) >= 500)
     or (tg_table_name = 'followed_bills' and (select count(*) from public.followed_bills where user_id = new.user_id) >= 500) then
    raise exception 'You can save up to 500 items of each kind.';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_follows() from public, anon, authenticated;
create trigger followed_officials_limit before insert on followed_officials for each row execute function public.limit_follows();
create trigger followed_bills_limit before insert on followed_bills for each row execute function public.limit_follows();

-- ---------------------------------------------------------------------------
-- Row Level Security and grants: own rows only, signed-in only.
-- ---------------------------------------------------------------------------
alter table account_prefs        enable row level security;
alter table email_consent_events enable row level security;
alter table followed_officials   enable row level security;
alter table followed_bills       enable row level security;

revoke all on account_prefs, email_consent_events, followed_officials, followed_bills from anon, authenticated;

create policy "own prefs: read"   on account_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy "own prefs: update" on account_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on account_prefs to authenticated;
-- Only the choices can be changed; the token, the change times and the owner can't.
grant update (language, weekly_digest, bill_updates, election_reminders, election_state, districts) on account_prefs to authenticated;

create policy "own consent record: read" on email_consent_events for select to authenticated using (user_id = (select auth.uid()));
grant select on email_consent_events to authenticated;

create policy "own officials: read"   on followed_officials for select to authenticated using (user_id = (select auth.uid()));
create policy "own officials: add"    on followed_officials for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own officials: remove" on followed_officials for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on followed_officials to authenticated;
grant insert (kind, official_id) on followed_officials to authenticated;

create policy "own bills: read"   on followed_bills for select to authenticated using (user_id = (select auth.uid()));
create policy "own bills: add"    on followed_bills for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own bills: remove" on followed_bills for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on followed_bills to authenticated;
grant insert (congress, bill_type, number) on followed_bills to authenticated;

-- ---------------------------------------------------------------------------
-- Functions the site calls
-- ---------------------------------------------------------------------------

-- Delete the signed-in account and everything saved with it (cascades from auth.users:
-- preferences, consent record, saved officials and bills, sign-in identities and sessions).
create or replace function public.delete_my_account() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in.'; end if;
  delete from auth.users where id = me;
  return found;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Everything stored for the signed-in account, as one JSON document ("Download my data").
create or replace function public.my_account_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
                  'last_sign_in_at', u.last_sign_in_at,
                  'sign_in_methods', (select coalesce(jsonb_agg(distinct i.provider), '[]'::jsonb) from auth.identities i where i.user_id = u.id))
                from auth.users u where u.id = auth.uid()),
    'email_preferences', (select to_jsonb(p) from public.account_prefs p where p.user_id = auth.uid()),
    'email_consent_record', (select coalesce(jsonb_agg(to_jsonb(e) - 'user_id' order by e.at), '[]'::jsonb) from public.email_consent_events e where e.user_id = auth.uid()),
    'followed_officials', (select coalesce(jsonb_agg(jsonb_build_object('kind', f.kind, 'id', f.official_id, 'saved_at', f.created_at) order by f.created_at), '[]'::jsonb) from public.followed_officials f where f.user_id = auth.uid()),
    'followed_bills', (select coalesce(jsonb_agg(jsonb_build_object('congress', b.congress, 'type', b.bill_type, 'number', b.number, 'saved_at', b.created_at) order by b.created_at), '[]'::jsonb) from public.followed_bills b where b.user_id = auth.uid())
  )
  where auth.uid() is not null;
$$;
revoke all on function public.my_account_data() from public, anon;
grant execute on function public.my_account_data() to authenticated;

-- One-click unsubscribe from an email link, no sign-in needed. The token is random and
-- unguessable; kind is one email type or 'all'. Returns false for an unknown token.
create or replace function public.unsubscribe_email(token uuid, kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if kind not in ('weekly_digest', 'bill_updates', 'election_reminders', 'all') then
    raise exception 'Unknown email type.';
  end if;
  perform set_config('civic_atlas.consent_source', 'unsubscribe_link', true);
  update public.account_prefs set
    weekly_digest      = case when kind in ('weekly_digest', 'all') then false else weekly_digest end,
    bill_updates       = case when kind in ('bill_updates', 'all') then false else bill_updates end,
    election_reminders = case when kind in ('election_reminders', 'all') then false else election_reminders end
  where unsubscribe_token = token;
  return found;
end;
$$;
revoke all on function public.unsubscribe_email(uuid, text) from public;
grant execute on function public.unsubscribe_email(uuid, text) to anon, authenticated;
