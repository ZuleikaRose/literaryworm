-- Log-in alerts: an email to the account's address a few minutes after each new log-in, with the kind
-- of browser and device and the time, so a member hears about a log-in they didn't make.
--
-- * account_private.sign_in_emails: on by default; the member turns it off in Account → Sign-in.
-- * sign_in_alerts: a copy of each new auth.sessions row's user agent and time, made by a trigger
--   on auth.sessions (a log-in, not a token refresh). Service role only. Rows are claimed once by
--   claim_sign_in_alerts() for the sign-in-alerts function, which pg_cron calls every 5 minutes,
--   and deleted within a day.
-- * The Edge Functions' own password checks (confirmPassword() signs in with the service role) end
--   their session at once, and come from Deno: neither is ever emailed about. An alert is sent only
--   while its session still exists, two minutes after it began.
-- * The first log-in within 30 minutes of signing up isn't emailed about.
-- The trigger never stops a log-in: anything that goes wrong in it is only a warning.

alter table public.account_private add column sign_in_emails boolean not null default true;
grant select (sign_in_emails), update (sign_in_emails) on public.account_private to authenticated;

create table public.sign_in_alerts (
  session_id   uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- The browser's own description (its user agent), cut to 300 characters; the function names it.
  device       text not null default '' check (char_length(device) <= 300),
  signed_in_at timestamptz not null,
  claimed_at   timestamptz
);
-- The index for user_id (the foreign key) is in the next migration (CREATE INDEX CONCURRENTLY).

alter table public.sign_in_alerts enable row level security;
revoke all on public.sign_in_alerts from anon, authenticated;
grant select, insert, update, delete on public.sign_in_alerts to service_role;

create or replace function private.queue_sign_in_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    -- The Edge Functions' password re-checks (supabase-js on Deno), never a member's browser.
    if coalesce(new.user_agent, '') like 'Deno/%' then
      return new;
    end if;
    -- The log-in that comes with signing up.
    if exists (select 1 from auth.users u where u.id = new.user_id and u.created_at > now() - interval '30 minutes') then
      return new;
    end if;
    insert into public.sign_in_alerts (session_id, user_id, device, signed_in_at)
    values (new.id, new.user_id, left(coalesce(new.user_agent, ''), 300), coalesce(new.created_at, now()))
    on conflict (session_id) do nothing;
  exception when others then
    raise warning 'sign-in alerts: could not queue session %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function private.queue_sign_in_alert() from public, anon, authenticated;

create trigger queue_sign_in_alert
  after insert on auth.sessions
  for each row execute function private.queue_sign_in_alert();

-- Claims due alerts once: two minutes after the log-in, while its session still exists, for an
-- account that hasn't turned them off and has a confirmed address. Clears what won't be sent and
-- anything older than a day.
create or replace function public.claim_sign_in_alerts(max_count integer default 200)
returns table (session_id uuid, email text, display_name text, device text, signed_in_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.sign_in_alerts a
  where a.signed_in_at < now() - interval '1 day'
     or (a.claimed_at is null and a.signed_in_at < now() - interval '2 minutes'
         and not exists (select 1 from auth.sessions s where s.id = a.session_id))
     or (a.claimed_at is null and exists (
           select 1 from public.account_private p where p.user_id = a.user_id and not p.sign_in_emails));

  return query
  with due as (
    select a.session_id
    from public.sign_in_alerts a
    where a.claimed_at is null
      and a.signed_in_at < now() - interval '2 minutes'
    order by a.signed_in_at
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update skip locked
  ), claimed as (
    update public.sign_in_alerts a set claimed_at = now()
    from due where a.session_id = due.session_id
    returning a.session_id, a.user_id, a.device, a.signed_in_at
  )
  select c.session_id, u.email::text, p.display_name, c.device, c.signed_in_at
  from claimed c
  join auth.users u on u.id = c.user_id and u.email is not null and u.email_confirmed_at is not null
  left join public.profiles p on p.id = c.user_id;
end;
$$;
revoke execute on function public.claim_sign_in_alerts(integer) from public, anon, authenticated;
grant execute on function public.claim_sign_in_alerts(integer) to service_role;

-- An alert whose email failed: handed back for the next run.
create or replace function public.release_sign_in_alert(p_session uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.sign_in_alerts set claimed_at = null where session_id = p_session;
$$;
revoke execute on function public.release_sign_in_alert(uuid) from public, anon, authenticated;
grant execute on function public.release_sign_in_alert(uuid) to service_role;

-- The secret the cron job sends and the sign-in-alerts function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sign_in_alerts_secret', 'Sent by the sign-in-alerts cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'sign_in_alerts_secret');

create or replace function public.sign_in_alerts_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'sign_in_alerts_secret';
$$;
revoke execute on function public.sign_in_alerts_secret() from public, anon, authenticated;
grant execute on function public.sign_in_alerts_secret() to service_role;

create or replace function private.call_sign_in_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'sign_in_alerts_secret');
begin
  -- Nothing to do: no call at all.
  if not exists (select 1 from public.sign_in_alerts where claimed_at is null) then
    return;
  end if;
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/sign-in-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function private.call_sign_in_alerts() from public, anon, authenticated;

select cron.schedule('sign-in-alerts', '*/5 * * * *', $$select private.call_sign_in_alerts()$$);
