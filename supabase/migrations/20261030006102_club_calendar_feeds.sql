-- Calendar feeds for book clubs: each member gets a subscribe link for a club's meetings, which
-- calendar apps read from the club-calendar function every so often.
--
-- A link carries the club, the member and an HMAC-SHA256 of both, signed with the key below (kept
-- in Vault, read only by the service role), so nothing new is stored and a link can't be made up
-- or changed to another club. The function checks membership on every read: someone who leaves
-- the club stops getting its meetings.

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'club_calendar_secret', 'Signs book club calendar feed links; checked by the club-calendar function')
where not exists (select 1 from vault.secrets where name = 'club_calendar_secret');

create or replace function public.club_calendar_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'club_calendar_secret';
$$;
revoke execute on function public.club_calendar_secret() from public, anon, authenticated;
grant execute on function public.club_calendar_secret() to service_role;
