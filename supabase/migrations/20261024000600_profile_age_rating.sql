-- Phase 8: changing a profile's age rating after it was created.
--
-- The browser can't set age_rating on an existing profile (no column grant), so
-- the manage-profile Edge Function calls this after re-checking the account
-- password. Moving a profile to Kids records the parent's consent, as
-- create_kids_profile does; moving it off Kids marks that consent withdrawn
-- (the record itself is kept for as long as the law requires).

create or replace function public.set_profile_age_rating(
  p_account_id uuid, p_profile_id uuid, p_age_rating public.age_rating, p_notice_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_rating public.age_rating;
begin
  select age_rating into current_rating from public.reader_profiles
  where id = p_profile_id and account_id = p_account_id
  for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'no_data_found';
  end if;
  if current_rating = p_age_rating then
    return;
  end if;

  if p_age_rating = 'kids' then
    if p_notice_version is null or char_length(p_notice_version) not between 1 and 40 then
      raise exception 'A Kids profile needs the parent''s consent' using errcode = 'check_violation';
    end if;
    update public.reader_profiles
    set age_rating = 'kids', kids_consent_at = now()
    where id = p_profile_id;
    insert into public.parental_consents (account_id, profile_id, notice_version)
    values (p_account_id, p_profile_id, p_notice_version);
  else
    update public.reader_profiles
    set age_rating = p_age_rating, kids_consent_at = null
    where id = p_profile_id;
    update public.parental_consents
    set withdrawn_at = now()
    where profile_id = p_profile_id and account_id = p_account_id and withdrawn_at is null;
  end if;
end;
$$;

revoke execute on function public.set_profile_age_rating(uuid, uuid, public.age_rating, text) from public, anon, authenticated;
grant execute on function public.set_profile_age_rating(uuid, uuid, public.age_rating, text) to service_role;
