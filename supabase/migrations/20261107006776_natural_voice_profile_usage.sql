-- The family listening report (Account → Family, components/FamilyUsage.tsx): how much new
-- natural-voice reading each profile had voiced a month, beside its audiobook listening (which
-- reading_days already keeps). Written only by record_natural_voice_profile() from the
-- natural-voice function after a piece is voiced; the account reads its own rows. The account's
-- allowance is still natural_voice_usage; this only says who used it.

create table if not exists public.natural_voice_profile_usage (
  account_id uuid not null,
  profile_id uuid not null,
  -- The first day of the month (UTC).
  month      date not null check (extract(day from month) = 1),
  characters integer not null default 0 check (characters >= 0),
  primary key (account_id, profile_id, month),
  foreign key (profile_id, account_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.natural_voice_profile_usage enable row level security;

drop policy if exists "Members see their profiles' natural voice use" on public.natural_voice_profile_usage;
create policy "Members see their profiles' natural voice use" on public.natural_voice_profile_usage for select to authenticated
  using (account_id = (select auth.uid()));
drop policy if exists "Two-step sign-in when turned on" on public.natural_voice_profile_usage;
create policy "Two-step sign-in when turned on" on public.natural_voice_profile_usage as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.natural_voice_profile_usage from anon, authenticated;
grant select (account_id, profile_id, month, characters) on public.natural_voice_profile_usage to authenticated;
grant all on public.natural_voice_profile_usage to service_role;

-- Adds a voiced piece's characters to its profile's month (the natural-voice function, service role).
create or replace function public.record_natural_voice_profile(p_account uuid, p_profile uuid, p_characters integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.natural_voice_profile_usage (account_id, profile_id, month, characters)
  values (p_account, p_profile, date_trunc('month', now() at time zone 'utc')::date, greatest(0, p_characters))
  on conflict (account_id, profile_id, month) do update
    set characters = public.natural_voice_profile_usage.characters + excluded.characters;
$$;
revoke execute on function public.record_natural_voice_profile(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.record_natural_voice_profile(uuid, uuid, integer) to service_role;

-- Kept a year, like the rest of the month counts.
select cron.schedule('natural-voice-profile-usage-cleanup', '40 3 * * *',
  $$delete from public.natural_voice_profile_usage where month < (date_trunc('month', now()) - interval '12 months')::date$$);
