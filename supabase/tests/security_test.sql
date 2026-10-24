-- Security checks for the migrations: RLS isolation, column grants, sign-up
-- validation, plan limits, Kids consent and age-rating changes, PIN lockout, rate limits, and the
-- "logs, progress and bookmarks need a library item" rule. Run against a scratch database after the
-- migrations (see supabase/README.md). Any failed check raises and stops.
\set ON_ERROR_STOP on

-- Helpers ---------------------------------------------------------------------
create or replace function pg_temp.expect_error(sql text, what text)
returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: % should have been refused', what;
exception
  when raise_exception then raise;          -- our own FAIL above
  when others then raise notice 'ok: % refused (%)', what, sqlerrm;
end $$;

create or replace function pg_temp.check(cond boolean, what text)
returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', what; end if;
  raise notice 'ok: %', what;
end $$;

grant execute on function pg_temp.expect_error(text, text), pg_temp.check(boolean, text) to anon, authenticated, service_role;

-- Sign-up (anonymous input) ---------------------------------------------------
select pg_temp.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('x@test', '{"display_name":"","date_of_birth":"1990-01-01","terms_accepted":true}')$$, 'empty display name');
select pg_temp.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('x@test', '{"display_name":"Kid","date_of_birth":"2015-01-01","terms_accepted":true}')$$, 'under-18 account holder');
select pg_temp.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('x@test', '{"display_name":"Ann","date_of_birth":"01/02/1990","terms_accepted":true}')$$, 'badly formatted date of birth');
select pg_temp.expect_error($$insert into auth.users (email, raw_user_meta_data) values ('x@test', '{"display_name":"Ann","date_of_birth":"1990-01-01"}')$$, 'sign-up without accepting the Terms');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test', '{"display_name":"Ann","date_of_birth":"1990-01-01","terms_accepted":true}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test', '{"display_name":"Ben","date_of_birth":"1985-06-30","terms_accepted":true}');
select pg_temp.check((select count(*) from public.profiles) = 2 and (select count(*) from public.account_private) = 2, 'valid sign-ups create profiles and account_private rows');

-- Server-side setup: Ann has Standard (3 profiles), Ben has no plan.
insert into public.subscriptions (user_id, plan_id, billing_day, renewal_terms_accepted_at)
values ('00000000-0000-0000-0000-00000000000a', 'standard', 5, now());

-- Anonymous visitors ----------------------------------------------------------
set role anon;
select pg_temp.check((select count(*) from public.profiles) = 2, 'anon can read display names');
select pg_temp.check((select count(*) from public.plans) = 3, 'anon can read plans');
select pg_temp.expect_error('select date_of_birth from public.account_private', 'anon reading account_private');
select pg_temp.expect_error('select * from public.library_items', 'anon reading libraries');
select pg_temp.expect_error('select * from public.subscriptions', 'anon reading subscriptions');
select pg_temp.expect_error('select * from public.reader_profiles', 'anon reading reader profiles');
select pg_temp.expect_error($$select public.check_rate_limit('x', 1, 60)$$, 'anon calling check_rate_limit');
select pg_temp.expect_error($$select public.verify_profile_pin(gen_random_uuid(), gen_random_uuid(), '1234')$$, 'anon calling verify_profile_pin');
select pg_temp.expect_error($$insert into public.logs (user_id, volume_id, body) values ('00000000-0000-0000-0000-00000000000a', 'abc', 'hi')$$, 'anon writing a log');
select pg_temp.expect_error('select * from public.reading_progress', 'anon reading progress');
select pg_temp.expect_error('select * from public.bookmarks', 'anon reading bookmarks');
reset role;

-- Ann, signed in --------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from public.account_private) = 1, 'Ann sees only her own account details');
select pg_temp.expect_error($$update public.account_private set date_of_birth = '2010-01-01'$$, 'changing date of birth from the browser');
select pg_temp.expect_error('select stripe_customer_id from public.subscriptions', 'reading Stripe ids');
select pg_temp.expect_error($$update public.subscriptions set plan_id = 'premium'$$, 'changing plan from the browser');
with u as (update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b' returning 1)
select pg_temp.check(count(*) = 0, 'renaming someone else changes nothing (RLS)') from u;

insert into public.reader_profiles (account_id, name) values ('00000000-0000-0000-0000-00000000000a', 'Ann');
insert into public.reader_profiles (account_id, name) values ('00000000-0000-0000-0000-00000000000a', 'Sam');
select pg_temp.expect_error($$insert into public.reader_profiles (account_id, name) values ('00000000-0000-0000-0000-00000000000a', 'sam')$$, 'duplicate profile name (case-insensitive)');
select pg_temp.expect_error($$insert into public.reader_profiles (account_id, name, age_rating) values ('00000000-0000-0000-0000-00000000000a', 'Mia', 'kids')$$, 'Kids profile from the browser');
select pg_temp.expect_error($$insert into public.reader_profiles (account_id, name) values ('00000000-0000-0000-0000-00000000000b', 'Spy')$$, 'adding a profile to someone else''s account');
select pg_temp.expect_error('select pin_hash from public.reader_profiles', 'reading PIN hashes');
select pg_temp.expect_error($$update public.reader_profiles set locked_until = null$$, 'clearing a PIN lock from the browser');
select pg_temp.expect_error($$delete from public.reader_profiles where name = 'Sam'$$, 'deleting a profile without the password check');
select pg_temp.expect_error($$update public.reader_profiles set age_rating = 'teen' where name = 'Sam'$$, 'changing an age rating from the browser');
select pg_temp.expect_error($$select public.set_profile_age_rating((select account_id from public.reader_profiles where name = 'Sam'), (select id from public.reader_profiles where name = 'Sam'), 'kids', 'v1')$$, 'calling set_profile_age_rating from the browser');

insert into public.library_items (user_id, volume_id, status) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 'reading');
insert into public.logs (user_id, volume_id, body, rating) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 'Great start.', 4);
select pg_temp.expect_error($$insert into public.logs (user_id, volume_id, body) values ('00000000-0000-0000-0000-00000000000a', 'notInLibrary1', 'x')$$, 'a log for a book not in the library');
select pg_temp.expect_error($$insert into public.logs (user_id, volume_id, body, rating) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 'x', 6)$$, 'a rating of 6');
select pg_temp.expect_error($$insert into public.library_items (user_id, volume_id) values ('00000000-0000-0000-0000-00000000000a', 'bad id; drop')$$, 'a malformed volume id');
select pg_temp.expect_error($$update public.logs set user_id = '00000000-0000-0000-0000-00000000000b'$$, 'moving a log to another user');

insert into public.reading_progress (user_id, volume_id, format, chapter_index, position) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 'ebook', 2, 0.25);
update public.reading_progress set position = 0.5, chapter_index = 4, format = 'audiobook' where volume_id = 'zyTCAlFPjgYC';
insert into public.bookmarks (user_id, volume_id, format, chapter_index, position, label) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 'ebook', 2, 0.25, 'Chapter 3, page 2');
select pg_temp.expect_error($$insert into public.reading_progress (user_id, volume_id, format, chapter_index, position) values ('00000000-0000-0000-0000-00000000000a', 'notInLibrary1', 'ebook', 0, 0)$$, 'progress for a book not in the library');
select pg_temp.expect_error($$insert into public.bookmarks (user_id, volume_id, format, chapter_index, position, label) values ('00000000-0000-0000-0000-00000000000a', 'notInLibrary1', 'ebook', 0, 0, 'x')$$, 'a bookmark for a book not in the library');
select pg_temp.expect_error($$update public.reading_progress set position = 1.5$$, 'a position past the end');
select pg_temp.expect_error($$insert into public.bookmarks (user_id, volume_id, format, chapter_index, position, label) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 'ebook', 0, 0, '   ')$$, 'a blank bookmark label');
select pg_temp.expect_error($$update public.reading_progress set user_id = '00000000-0000-0000-0000-00000000000b'$$, 'moving progress to another user');
select pg_temp.expect_error($$update public.bookmarks set label = 'edited'$$, 'editing a bookmark');
reset role;

-- Ben, signed in --------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.library_items) = 0, 'Ben cannot see Ann''s library');
select pg_temp.check((select count(*) from public.logs) = 1, 'Ben can read Ann''s public log');
select pg_temp.check((select count(*) from public.reader_profiles) = 0, 'Ben cannot see Ann''s profiles');
with d as (delete from public.logs where user_id = '00000000-0000-0000-0000-00000000000a' returning 1)
select pg_temp.check(count(*) = 0, 'Ben cannot delete Ann''s log') from d;
select pg_temp.expect_error($$insert into public.logs (user_id, volume_id, body) values ('00000000-0000-0000-0000-00000000000b', 'zyTCAlFPjgYC', 'piggyback on Ann''s library')$$, 'a log against someone else''s library item');
select pg_temp.check((select count(*) from public.reading_progress) = 0 and (select count(*) from public.bookmarks) = 0, 'Ben cannot see Ann''s progress or bookmarks');
with u as (update public.reading_progress set position = 0 returning 1)
select pg_temp.check(count(*) = 0, 'Ben cannot change Ann''s progress') from u;
with d as (delete from public.bookmarks where volume_id = 'zyTCAlFPjgYC' returning 1)
select pg_temp.check(count(*) = 0, 'Ben cannot delete Ann''s bookmark') from d;
select pg_temp.expect_error($$insert into public.reading_progress (user_id, volume_id, format, chapter_index, position) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 'ebook', 0, 0)$$, 'saving progress into Ann''s account');
insert into public.reader_profiles (account_id, name) values ('00000000-0000-0000-0000-00000000000b', 'Ben');
select pg_temp.expect_error($$insert into public.reader_profiles (account_id, name) values ('00000000-0000-0000-0000-00000000000b', 'Two')$$, 'a second profile with no plan');
reset role;

-- Edge Function (service role) ------------------------------------------------
set role service_role;
select pg_temp.check(public.create_kids_profile('00000000-0000-0000-0000-00000000000a', 'Mia', 2::smallint, 60::smallint, '2026-10') is not null, 'Kids profile with consent via the server');
select pg_temp.check((select count(*) from public.parental_consents) = 1, 'consent recorded');
select pg_temp.expect_error($$select public.create_kids_profile('00000000-0000-0000-0000-00000000000a', 'Fourth', 0::smallint, null, '2026-10')$$, 'a 4th profile on Standard');

select public.set_profile_pin('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'), '4821');
select pg_temp.check((select pin_hash <> '4821' and pin_hash like '$2%' from public.reader_profiles where name = 'Sam'), 'PIN stored as a bcrypt hash');
select pg_temp.expect_error($$select public.set_profile_pin('00000000-0000-0000-0000-00000000000b', (select id from public.reader_profiles where name = 'Sam'), '1111')$$, 'setting a PIN on another account''s profile');
select pg_temp.check((public.verify_profile_pin('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'), '4821') ->> 'ok')::boolean, 'right PIN accepted');
select public.verify_profile_pin('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'), '0000') from generate_series(1, 5);
select pg_temp.check((select locked_until > now() from public.reader_profiles where name = 'Sam'), 'locked after 5 wrong PINs');
select pg_temp.check(not (public.verify_profile_pin('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'), '4821') ->> 'ok')::boolean, 'right PIN refused while locked');
select public.unlock_profile('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'));
select pg_temp.check((public.verify_profile_pin('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'), '4821') ->> 'ok')::boolean, 'unlocked after the password check');

select public.set_profile_age_rating('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'), 'kids', '2026-10');
select pg_temp.check((select age_rating = 'kids' and kids_consent_at is not null from public.reader_profiles where name = 'Sam'), 'moved to Kids with consent via the server');
select pg_temp.check((select count(*) from public.parental_consents where profile_id = (select id from public.reader_profiles where name = 'Sam') and withdrawn_at is null) = 1, 'consent recorded for the move to Kids');
select pg_temp.expect_error($$select public.set_profile_age_rating('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Ann'), 'kids', null)$$, 'moving to Kids without consent');
select pg_temp.expect_error($$select public.set_profile_age_rating('00000000-0000-0000-0000-00000000000b', (select id from public.reader_profiles where name = 'Sam'), 'all', null)$$, 'changing another account''s profile rating');
select public.set_profile_age_rating('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'), 'teen', null);
select pg_temp.check((select age_rating = 'teen' and kids_consent_at is null from public.reader_profiles where name = 'Sam'), 'moved off Kids');
select pg_temp.check((select count(*) from public.parental_consents where profile_id = (select id from public.reader_profiles where name = 'Sam') and withdrawn_at is not null) = 1, 'consent marked withdrawn, record kept');
select pg_temp.check(public.check_rate_limit('test:1', 2, 60) and public.check_rate_limit('test:1', 2, 60) and not public.check_rate_limit('test:1', 2, 60), 'rate limit allows 2 then refuses');
reset role;

-- Removing a book deletes its logs, progress and bookmarks -------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select position from public.reading_progress) = 0.5, 'Ann''s progress kept after Ben''s attempts');
delete from public.library_items where volume_id = 'zyTCAlFPjgYC';
select pg_temp.check((select count(*) from public.logs) = 0, 'logs deleted with the library item');
select pg_temp.check((select count(*) from public.reading_progress) = 0 and (select count(*) from public.bookmarks) = 0, 'progress and bookmarks deleted with the library item');
reset role;

-- Every public table has RLS on -----------------------------------------------
select pg_temp.check(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity
), 'RLS enabled on every table');

-- Every foreign key has an index that starts with its columns ----------------
select pg_temp.check(not exists (
  select 1 from pg_constraint fk
  where fk.contype = 'f' and fk.connamespace = 'public'::regnamespace
    and not exists (
      select 1 from pg_index i
      where i.indrelid = fk.conrelid
        and (i.indkey::int2[])[0:cardinality(fk.conkey) - 1] = fk.conkey
    )
), 'every foreign key is indexed');

\echo ALL SECURITY CHECKS PASSED
