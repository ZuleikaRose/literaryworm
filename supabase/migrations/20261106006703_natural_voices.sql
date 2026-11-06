-- Natural voices for uploaded books (the natural-voice Edge Function, Google Cloud Text-to-Speech).
-- A member's upload is voiced a piece at a time as they listen; each piece is kept in the private
-- upload-voices bucket at <user_id>/<upload_id>/<voice>-<chapter>-<piece>.mp3, so listening again
-- is free, and is deleted with the upload, the profile or the account. Each account has a monthly
-- allowance of new voicing by plan (NATURAL_VOICE_HOURS in lib/naturalVoice.ts and
-- _shared/naturalVoice.ts), counted here in characters sent to Google.

create table if not exists public.natural_voice_usage (
  account_id uuid not null references auth.users (id) on delete cascade,
  -- The first day of the month (UTC).
  month      date not null check (extract(day from month) = 1),
  characters integer not null default 0 check (characters >= 0),
  primary key (account_id, month)
);

comment on table public.natural_voice_usage is
  'Characters of each account''s uploads sent to Google Text-to-Speech a month (natural voices). Written only by claim_natural_voice() and release_natural_voice() from the natural-voice function.';

alter table public.natural_voice_usage enable row level security;

drop policy if exists "Members see their natural voice use" on public.natural_voice_usage;
create policy "Members see their natural voice use" on public.natural_voice_usage for select to authenticated
  using (account_id = (select auth.uid()));
drop policy if exists "Two-step sign-in when turned on" on public.natural_voice_usage;
create policy "Two-step sign-in when turned on" on public.natural_voice_usage as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.natural_voice_usage from anon, authenticated;
grant select (account_id, month, characters) on public.natural_voice_usage to authenticated;
grant all on public.natural_voice_usage to service_role;

-- Counts p_characters against this month's p_limit; false (and nothing counted) when it won't fit.
create or replace function public.claim_natural_voice(p_account uuid, p_characters integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if p_account is null or p_characters is null or p_characters < 1 or p_characters > 5000 or p_limit is null or p_limit < 0 then
    raise exception 'claim_natural_voice: bad arguments';
  end if;
  insert into public.natural_voice_usage (account_id, month) values (p_account, v_month)
  on conflict (account_id, month) do nothing;
  update public.natural_voice_usage
     set characters = characters + p_characters
   where account_id = p_account and month = v_month and characters + p_characters <= p_limit;
  return found;
end;
$$;

-- Hands back a claim when Google couldn't voice the piece.
create or replace function public.release_natural_voice(p_account uuid, p_characters integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.natural_voice_usage
     set characters = greatest(0, characters - p_characters)
   where account_id = p_account and month = date_trunc('month', now() at time zone 'utc')::date;
$$;

revoke execute on function public.claim_natural_voice(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.release_natural_voice(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_natural_voice(uuid, integer, integer) to service_role;
grant execute on function public.release_natural_voice(uuid, integer) to service_role;

-- The bucket: private, MP3 only, 5 MB a piece. Only the function writes to it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('upload-voices', 'upload-voices', false, 5242880, array['audio/mpeg'])
on conflict (id) do nothing;

-- Members read and remove the pieces in their own folder (playing them, deleting an upload).
drop policy if exists "Members read their own voiced pieces" on storage.objects;
create policy "Members read their own voiced pieces" on storage.objects for select to authenticated
  using (bucket_id = 'upload-voices' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Members remove their own voiced pieces" on storage.objects;
create policy "Members remove their own voiced pieces" on storage.objects for delete to authenticated
  using (bucket_id = 'upload-voices' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Two-step sign-in for voiced pieces" on storage.objects;
create policy "Two-step sign-in for voiced pieces" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'upload-voices' or (select public.second_step_done()))
  with check (bucket_id <> 'upload-voices' or (select public.second_step_done()));
