-- Two-step sign-in (TOTP, Supabase Auth MFA).
--
-- A member who turns it on signs in with their password (a session at aal1),
-- then a code from their authenticator app (aal2). Until the code is given,
-- the session can reach nothing of theirs: every table a member uses gets a
-- restrictive policy that needs aal2 from anyone with a verified factor.
-- Members without one are unaffected. Public reads (logs, display names,
-- plans, legal pages) stay open; only writes to those tables need the code.
--
-- Security-definer functions skip RLS, so the two that act for a member check
-- for themselves: has_staff_role() (used by every staff function and policy)
-- and join_club(). The user-books bucket gets the same restrictive policy.
-- Edge Functions check the session's aal in _shared/supabase.ts.

-- True unless the caller has a verified factor and the session hasn't used it.
-- Security definer to read auth.mfa_factors; it only ever answers for the caller.
create or replace function public.second_step_done()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

revoke execute on function public.second_step_done() from public, anon;
grant execute on function public.second_step_done() to authenticated, service_role;


-- Private tables: no reading or writing without the second step ---------------
create policy "Two-step sign-in when turned on" on public.account_private      as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.book_clubs           as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.book_ratings         as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.bookmarks            as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.club_listening       as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.club_members         as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.club_posts           as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.custom_list_items    as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.custom_lists         as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.favorites            as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.finished_books       as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.highlights           as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.legal_page_revisions as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.library_items        as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.listening_devices    as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.parental_consents    as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.playback_handoffs    as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.reader_profiles      as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.reading_days         as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.reading_goals        as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.reading_progress     as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.staff_roles          as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.subscriptions        as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.uploaded_books       as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Publicly readable tables: reading stays open, writing needs the second step --
create policy "Two-step sign-in to write logs" on public.logs as restrictive for insert to authenticated with check ((select public.second_step_done()));
create policy "Two-step sign-in to edit logs" on public.logs as restrictive for update to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in to delete logs" on public.logs as restrictive for delete to authenticated using ((select public.second_step_done()));
create policy "Two-step sign-in to change a display name" on public.profiles as restrictive for update to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in to edit legal pages" on public.legal_pages as restrictive for update to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Uploaded books' files ---------------------------------------------------------
create policy "Two-step sign-in for book files" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'user-books' or (select public.second_step_done()))
  with check (bucket_id <> 'user-books' or (select public.second_step_done()));


-- Security-definer callers -------------------------------------------------------
-- Staff functions run as their owner, so staff_roles' policies don't apply there.
create or replace function public.has_staff_role(p_role public.staff_role)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.second_step_done() and exists (
    select 1 from public.staff_roles
    where user_id = (select auth.uid()) and role in (p_role, 'admin')
  );
$$;

create or replace function public.join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_club uuid;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Log in to join a club' using errcode = 'insufficient_privilege';
  end if;
  if not public.check_rate_limit('join_club:' || v_user::text, 20, 3600) then
    raise exception 'Too many tries. Wait an hour and try again.' using errcode = 'check_violation';
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9]{10}$' then
    return null;
  end if;
  select id into v_club from public.book_clubs where invite_code = p_code;
  if v_club is null then
    return null;
  end if;
  if not exists (select 1 from public.club_members where club_id = v_club and user_id = v_user) then
    if (select count(*) from public.club_members where club_id = v_club) >= 50 then
      raise exception 'This club is full (50 members)' using errcode = 'check_violation';
    end if;
    insert into public.club_members (club_id, user_id) values (v_club, v_user);
  end if;
  return v_club;
end;
$$;
