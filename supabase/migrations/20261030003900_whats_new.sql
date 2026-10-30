-- What's new (new request): a public page of what changed in LiteraryWorm (new features,
-- fixes and updates), and a monthly email of the major ones for members who ask for it.
--
-- * changelog_entries: one change each, public to read; staff with the Editor or Developer
--   role (or admins) add, edit and delete them through RLS (has_staff_role(), which also
--   needs the two-step code when it's on). `major` entries go in the monthly email.
-- * account_private.update_emails: off until the member turns it on in Account →
--   Preferences (the email is optional, so it's opt-in).
-- * whats_new_sends: which accounts have had which month's email, so each gets it once.
--   Server only.
-- * The whats-new function (pg_cron on the 1st of each month, with a secret kept in Vault,
--   like release-emails) claims accounts through claim_whats_new_emails() and emails last
--   month's major entries. Every email carries a one-click unsubscribe link signed with
--   another Vault secret (unsubscribe_secret), which the unsubscribe function checks.

create table public.changelog_entries (
  id          uuid primary key default gen_random_uuid(),
  released_on date not null,
  version     text not null check (version ~ '^[0-9]{4}\.[0-9]{1,2}(\.[0-9]{1,3})?$'),
  kind        text not null check (kind in ('feature', 'fix', 'update')),
  title       text not null check (char_length(title) between 1 and 120 and title = btrim(title)),
  body        text not null check (char_length(body) between 1 and 1000 and body = btrim(body)),
  major       boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function private.touch_changelog_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.touch_changelog_entry() from public, anon, authenticated;

create trigger changelog_entries_touch
  before update on public.changelog_entries
  for each row execute function private.touch_changelog_entry();

alter table public.changelog_entries enable row level security;

create policy "Anyone reads what's new" on public.changelog_entries for select to anon, authenticated
  using (true);
create policy "Editors and developers add to what's new" on public.changelog_entries for insert to authenticated
  with check ((select public.has_staff_role('editor')) or (select public.has_staff_role('developer')));
create policy "Editors and developers change what's new" on public.changelog_entries for update to authenticated
  using ((select public.has_staff_role('editor')) or (select public.has_staff_role('developer')))
  with check ((select public.has_staff_role('editor')) or (select public.has_staff_role('developer')));
create policy "Editors and developers delete from what's new" on public.changelog_entries for delete to authenticated
  using ((select public.has_staff_role('editor')) or (select public.has_staff_role('developer')));

revoke all on public.changelog_entries from anon, authenticated;
grant select (id, released_on, version, kind, title, body, major, created_at) on public.changelog_entries to anon, authenticated;
grant insert (released_on, version, kind, title, body, major, created_by) on public.changelog_entries to authenticated;
grant update (released_on, version, kind, title, body, major) on public.changelog_entries to authenticated;
grant delete on public.changelog_entries to authenticated;

-- The monthly email: off until the member asks for it.
alter table public.account_private add column update_emails boolean not null default false;
grant select (update_emails), update (update_emails) on public.account_private to authenticated;

create table public.whats_new_sends (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The first day of the month the email covered.
  month   date not null check (extract(day from month) = 1),
  sent_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.whats_new_sends enable row level security;
revoke all on public.whats_new_sends from anon, authenticated;

-- Marks up to max_count accounts that asked for the email and haven't had p_month's yet, and
-- returns them with the address; the function hands back any it couldn't send.
create or replace function public.claim_whats_new_emails(p_month date, max_count integer default 500)
returns table (user_id uuid, email text, account_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select a.user_id
    from public.account_private a
    join auth.users u on u.id = a.user_id and u.email is not null and u.email_confirmed_at is not null
    where a.update_emails
      and not exists (select 1 from public.whats_new_sends s where s.user_id = a.user_id and s.month = p_month)
    order by a.user_id
    limit least(greatest(coalesce(max_count, 500), 1), 1000)
  ), claimed as (
    insert into public.whats_new_sends (user_id, month)
    select due.user_id, p_month from due
    on conflict do nothing
    returning whats_new_sends.user_id
  )
  select c.user_id, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id;
end;
$$;
revoke execute on function public.claim_whats_new_emails(date, integer) from public, anon, authenticated;
grant execute on function public.claim_whats_new_emails(date, integer) to service_role;

-- The secrets: one the cron job sends and the whats-new function checks, one that signs
-- unsubscribe links. 32 random bytes each, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'whats_new_secret', 'Sent by the whats-new cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'whats_new_secret');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'unsubscribe_secret', 'Signs one-click unsubscribe links in emails')
where not exists (select 1 from vault.secrets where name = 'unsubscribe_secret');

create or replace function public.whats_new_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'whats_new_secret';
$$;

create or replace function public.unsubscribe_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'unsubscribe_secret';
$$;
revoke execute on function public.whats_new_secret(), public.unsubscribe_secret() from public, anon, authenticated;
grant execute on function public.whats_new_secret(), public.unsubscribe_secret() to service_role;

create or replace function private.call_whats_new()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'whats_new_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/whats-new',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_whats_new() from public, anon, authenticated;

-- 10:00 UTC on the 1st of each month: last month's major changes. A run that's cut short
-- carries on the next day (accounts already sent are skipped), until the 3rd.
select cron.schedule('whats-new-email', '0 10 1-3 * *', $$select private.call_whats_new()$$);
