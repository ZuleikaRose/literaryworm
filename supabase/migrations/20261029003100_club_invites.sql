-- Club invites by email (new request): a club member types someone's email
-- address on the club page, and the club-invite function emails them a link
-- that joins the club (/clubs/join/<code>), through Mailgun's API.
--
-- The address itself is never stored. club_invites keeps a one-way fingerprint
-- of it (sha256 of the club and the lower-cased address, made by the function)
-- for 30 days, only so the same address isn't invited to the same club again
-- within a week, and so each member can send at most 10 invitations a day.
-- Nobody reads it from the browser; a daily pg_cron job removes rows after 30 days.

create table public.club_invites (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.book_clubs (id) on delete cascade,
  invited_by  uuid not null references public.profiles (id) on delete cascade,
  email_hash  text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now()
);
-- Foreign key indexes are in the 3101–3102 migrations (CREATE INDEX CONCURRENTLY runs outside a transaction).

alter table public.club_invites enable row level security;
-- No policies for anon or authenticated: only the club-invite function (service role) uses it.
create policy "Two-step sign-in when turned on" on public.club_invites as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
revoke all on public.club_invites from anon, authenticated;

-- Checks the inviter may invite to this club and records the invitation. For the
-- club-invite function only (service role), which has already checked who's asking.
-- Returns {status} as one of: ok (with the club's details for the email),
-- not_member, full, too_many, already_invited.
create or replace function public.record_club_invite(p_user uuid, p_club uuid, p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club   public.book_clubs%rowtype;
  v_invite uuid;
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'email_hash must be 64 hex digits' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.club_members where club_id = p_club and user_id = p_user) then
    return jsonb_build_object('status', 'not_member');
  end if;
  select * into v_club from public.book_clubs where id = p_club;
  if (select count(*) from public.club_members where club_id = p_club) >= 50 then
    return jsonb_build_object('status', 'full');
  end if;
  if (select count(*) from public.club_invites where invited_by = p_user and created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('status', 'too_many');
  end if;
  if exists (select 1 from public.club_invites
             where club_id = p_club and email_hash = p_email_hash and created_at > now() - interval '7 days') then
    return jsonb_build_object('status', 'already_invited');
  end if;
  insert into public.club_invites (club_id, invited_by, email_hash) values (p_club, p_user, p_email_hash)
  returning id into v_invite;
  return jsonb_build_object(
    'status', 'ok',
    'invite_id', v_invite,
    'club_name', v_club.name,
    'volume_id', v_club.volume_id,
    'finishes_on', v_club.finishes_on,
    'invite_code', v_club.invite_code,
    'inviter_name', (select display_name from public.profiles where id = p_user)
  );
end;
$$;
revoke execute on function public.record_club_invite(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_club_invite(uuid, uuid, text) to service_role;

-- Daily at 03:30 UTC: forget fingerprints older than 30 days.
select cron.schedule('club-invites-cleanup', '30 3 * * *',
  $job$delete from public.club_invites where created_at < now() - interval '30 days'$job$);
