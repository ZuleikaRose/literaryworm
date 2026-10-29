-- Security checks for the migrations: RLS isolation, column grants, sign-up
-- validation, plan limits, Kids consent and age-rating changes, PIN lockout, rate limits, and the
-- "logs, progress, bookmarks and highlights need a library item" rule, and per-profile lists, ratings and shared links, goals, reading stats, clubs, club notifications and listen along, uploaded books, staff roles (only admins grant or remove them, by email or as an invitation applied at sign-up; the last admin stays; admins' memberships are complimentary and never billed; Stripe customers and events are server-only) and editable legal pages (anyone reads; editors and admins edit; every edit keeps the old version), player settings, devices and handoffs, and two-step sign-in (a password-only session reaches nothing of a member who turned it on). Run against a scratch database after the
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
select pg_temp.expect_error('select * from public.stripe_customers', 'anon reading Stripe customers');
select pg_temp.expect_error('select * from public.stripe_events', 'anon reading Stripe events');
select pg_temp.expect_error('select * from public.reader_profiles', 'anon reading reader profiles');
select pg_temp.expect_error($$select public.check_rate_limit('x', 1, 60)$$, 'anon calling check_rate_limit');
select pg_temp.expect_error($$select public.verify_profile_pin(gen_random_uuid(), gen_random_uuid(), '1234')$$, 'anon calling verify_profile_pin');
select pg_temp.expect_error($$insert into public.logs (user_id, volume_id, body) values ('00000000-0000-0000-0000-00000000000a', 'abc', 'hi')$$, 'anon writing a log');
select pg_temp.expect_error('select * from public.reading_progress', 'anon reading progress');
select pg_temp.expect_error('select * from public.bookmarks', 'anon reading bookmarks');
select pg_temp.expect_error('select * from public.highlights', 'anon reading highlights');
reset role;

-- Ann, signed in --------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from public.account_private) = 1, 'Ann sees only her own account details');
select pg_temp.expect_error($$update public.account_private set date_of_birth = '2010-01-01'$$, 'changing date of birth from the browser');
select pg_temp.expect_error('select stripe_customer_id from public.subscriptions', 'reading Stripe ids');
select pg_temp.expect_error($$update public.subscriptions set plan_id = 'premium'$$, 'changing plan from the browser');
select pg_temp.check((select stripe_linked = false from public.subscriptions), 'a member sees whether their membership is billed through Stripe');
select pg_temp.expect_error('select * from public.stripe_customers', 'a member reading Stripe customers');
select pg_temp.expect_error('select * from public.stripe_events', 'a member reading Stripe events');
select pg_temp.expect_error($$insert into public.stripe_customers (user_id, customer_id) values ('00000000-0000-0000-0000-00000000000a', 'cus_x')$$, 'a member linking a Stripe customer');
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
insert into public.highlights (user_id, volume_id, chapter_index, page, start_offset, end_offset, quote, color, note) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 2, 1, 10, 42, 'the colour of weak tea', 'yellow', null);
update public.highlights set color = 'blue', note = 'Lovely image' where volume_id = 'zyTCAlFPjgYC';
select pg_temp.check((select color = 'blue' and note = 'Lovely image' from public.highlights), 'highlight colour and note edited');
select pg_temp.expect_error($$insert into public.highlights (user_id, volume_id, chapter_index, page, start_offset, end_offset, quote) values ('00000000-0000-0000-0000-00000000000a', 'notInLibrary1', 0, 0, 0, 5, 'words')$$, 'a highlight for a book not in the library');
select pg_temp.expect_error($$insert into public.highlights (user_id, volume_id, chapter_index, page, start_offset, end_offset, quote) values ('00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 0, 0, 9, 4, 'words')$$, 'a highlight that ends before it starts');
select pg_temp.expect_error($$update public.highlights set note = '   '$$, 'a blank note');
select pg_temp.expect_error($$update public.highlights set start_offset = 0$$, 'moving a highlighted passage');
select pg_temp.expect_error($$update public.highlights set user_id = '00000000-0000-0000-0000-00000000000b'$$, 'moving a highlight to another user');
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
select pg_temp.check((select count(*) from public.highlights) = 0, 'Ben cannot see Ann''s highlights');
with u as (update public.highlights set note = 'mine now' returning 1)
select pg_temp.check(count(*) = 0, 'Ben cannot change Ann''s highlight') from u;
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

-- Removing a book deletes its logs, progress, bookmarks and highlights -------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select position from public.reading_progress) = 0.5, 'Ann''s progress kept after Ben''s attempts');
delete from public.library_items where volume_id = 'zyTCAlFPjgYC';
select pg_temp.check((select count(*) from public.logs) = 0, 'logs deleted with the library item');
select pg_temp.check((select count(*) from public.reading_progress) = 0 and (select count(*) from public.bookmarks) = 0, 'progress and bookmarks deleted with the library item');
select pg_temp.check((select count(*) from public.highlights) = 0, 'highlights deleted with the library item');
reset role;

-- Favourites, ratings, lists and recent searches (per profile) ----------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.book_ratings (profile_id, user_id, volume_id, rating) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'dune', 'like');
update public.book_ratings set rating = 'love' where volume_id = 'dune';
insert into public.favorites (profile_id, user_id, volume_id) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC');
select pg_temp.check((select rating = 'love' from public.book_ratings) and (select count(*) from public.favorites) = 1, 'Ann rates and favourites as a profile');
select pg_temp.expect_error($$insert into public.favorites (profile_id, user_id, volume_id) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC')$$, 'the same favourite twice');
insert into public.follows (profile_id, user_id, kind, name) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'author', 'Matt Haig');
select pg_temp.check((select count(*) from public.follows) = 1, 'Ann follows an author as a profile');
select pg_temp.expect_error($$insert into public.follows (profile_id, user_id, kind, name) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'actor', 'X')$$, 'following something that isn''t an author or narrator');
select pg_temp.expect_error($$insert into public.follows (profile_id, user_id, kind, name) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'author', ' padded ')$$, 'a followed name with spaces around it');
select pg_temp.expect_error($$update public.follows set name = 'Someone else'$$, 'renaming a follow');
insert into public.release_reminders (profile_id, user_id, volume_id, title, author, release_date) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'zyTCAlFPjgYC', 'Next Book', 'A. Writer', current_date + 30);
select pg_temp.check((select count(*) from public.release_reminders) = 1, 'Ann sets a reminder for a book not out yet');
select pg_temp.expect_error($$insert into public.release_reminders (profile_id, user_id, volume_id, title, release_date) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'old', 'Old Book', current_date - 30)$$, 'a reminder for a book already out');
select pg_temp.expect_error($$update public.release_reminders set release_date = current_date + 1$$, 'moving a reminder''s date');
select pg_temp.expect_error($$insert into public.book_ratings (profile_id, user_id, volume_id, rating) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'bad id; drop', 'like')$$, 'a malformed volume id in a rating');
insert into public.custom_lists (profile_id, user_id, name, description) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'Holiday stack', 'Beach books');
select pg_temp.expect_error($$insert into public.custom_lists (profile_id, user_id, name) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', ' holiday STACK ')$$, 'a duplicate list name (case-insensitive)');
select pg_temp.expect_error($$insert into public.custom_lists (profile_id, user_id, name) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', '   ')$$, 'a blank list name');
insert into public.custom_list_items (list_id, user_id, volume_id) values ((select id from public.custom_lists where name = 'Holiday stack'), '00000000-0000-0000-0000-00000000000a', 'dune');
update public.custom_lists set share_slug = 'AbCdEfGhIjKlMnOpQrStUv' where name = 'Holiday stack';
select pg_temp.expect_error($$update public.custom_lists set share_slug = 'short' where name = 'Holiday stack'$$, 'a guessable share link');
select pg_temp.expect_error($$update public.custom_lists set user_id = '00000000-0000-0000-0000-00000000000b'$$, 'moving a list to another account');
select pg_temp.expect_error($$insert into public.custom_lists (profile_id, user_id, name, share_slug) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'Pre-shared', 'AbCdEfGhIjKlMnOpQrSt00')$$, 'setting a share link on insert (column grant)');
select pg_temp.expect_error($$insert into public.custom_lists (profile_id, user_id, name) values ((select id from public.reader_profiles where name = 'Mia'), '00000000-0000-0000-0000-00000000000a', 'Kids picks'); update public.custom_lists set share_slug = 'KidsKidsKidsKidsKids00' where name = 'Kids picks'$$, 'sharing a Kids profile''s list');
update public.reader_profiles set recent_searches = array['dune', 'circe'] where name = 'Ann';
select pg_temp.expect_error($$update public.reader_profiles set recent_searches = array['1','2','3','4','5','6','7','8','9'] where name = 'Ann'$$, 'more than 8 recent searches');
reset role;

-- Ids Ben could only have guessed.
select id as ann_profile from public.reader_profiles where name = 'Ann' \gset
select id as ann_list from public.custom_lists where name = 'Holiday stack' \gset

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.book_ratings) + (select count(*) from public.favorites) + (select count(*) from public.custom_lists) + (select count(*) from public.custom_list_items) = 0, 'Ben cannot see Ann''s ratings, favourites or lists');
insert into public.favorites (profile_id, user_id, volume_id) values ((select id from public.reader_profiles where name = 'Ben'), '00000000-0000-0000-0000-00000000000b', 'dune');
select pg_temp.expect_error(format('insert into public.favorites (profile_id, user_id, volume_id) values (%L, %L, %L)', :'ann_profile', '00000000-0000-0000-0000-00000000000b', 'x'), 'a favourite on another account''s profile, as yourself');
select pg_temp.expect_error(format('insert into public.favorites (profile_id, user_id, volume_id) values (%L, %L, %L)', :'ann_profile', '00000000-0000-0000-0000-00000000000a', 'x'), 'a favourite on another account''s profile, as them');
select pg_temp.check((select count(*) from public.follows) = 0, 'Ben cannot see who Ann follows');
select pg_temp.check((select count(*) from public.release_reminders) = 0, 'Ben cannot see Ann''s reminders');
select pg_temp.expect_error(format('insert into public.release_reminders (profile_id, user_id, volume_id, title, release_date) values (%L, %L, %L, %L, current_date + 5)', :'ann_profile', '00000000-0000-0000-0000-00000000000a', 'x', 'X'), 'a reminder on another account''s profile');
select pg_temp.expect_error(format('insert into public.follows (profile_id, user_id, kind, name) values (%L, %L, %L, %L)', :'ann_profile', '00000000-0000-0000-0000-00000000000a', 'author', 'X'), 'a follow on another account''s profile');
select pg_temp.expect_error(format('insert into public.custom_list_items (list_id, user_id, volume_id) values (%L, %L, %L)', :'ann_list', '00000000-0000-0000-0000-00000000000b', 'x'), 'adding to someone else''s list, as yourself');
select pg_temp.expect_error(format('insert into public.custom_list_items (list_id, user_id, volume_id) values (%L, %L, %L)', :'ann_list', '00000000-0000-0000-0000-00000000000a', 'x'), 'adding to someone else''s list, as them');
with u as (update public.custom_lists set share_slug = null returning 1)
select pg_temp.check(count(*) = 0, 'Ben cannot stop Ann''s sharing') from u;
reset role;

set role anon;
select pg_temp.expect_error('select * from public.custom_lists', 'anon reading lists');
select pg_temp.expect_error('select * from public.favorites', 'anon reading favourites');
select pg_temp.expect_error('select * from public.follows', 'anon reading follows');
select pg_temp.expect_error('select * from public.release_reminders', 'anon reading reminders');
select pg_temp.check((public.shared_list('AbCdEfGhIjKlMnOpQrStUv') ->> 'name') = 'Holiday stack'
  and (public.shared_list('AbCdEfGhIjKlMnOpQrStUv') ->> 'owner') = 'Ann'
  and jsonb_array_length(public.shared_list('AbCdEfGhIjKlMnOpQrStUv') -> 'items') = 1
  and not (public.shared_list('AbCdEfGhIjKlMnOpQrStUv') ? 'user_id'), 'anyone with the link sees only the shared list''s name, owner and titles');
select pg_temp.check(public.shared_list('NotARealLinkNotARealLi') is null and public.shared_list('x'' or 1=1 --') is null, 'a wrong link shows nothing');
reset role;

-- A profile that becomes Kids stops sharing; deleting a profile deletes its lists.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.custom_lists (profile_id, user_id, name) values ((select id from public.reader_profiles where name = 'Sam'), '00000000-0000-0000-0000-00000000000a', 'Sam''s picks');
update public.custom_lists set share_slug = 'SamSamSamSamSamSamSam0' where name = 'Sam''s picks';
insert into public.favorites (profile_id, user_id, volume_id) values ((select id from public.reader_profiles where name = 'Sam'), '00000000-0000-0000-0000-00000000000a', 'dune');
reset role;
set role service_role;
select public.set_profile_age_rating('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Sam'), 'kids', '2026-10');
select pg_temp.check((select share_slug is null from public.custom_lists where name = 'Sam''s picks') and public.shared_list('SamSamSamSamSamSamSam0') is null, 'moving to Kids stops sharing');
delete from public.reader_profiles where name = 'Sam';
select pg_temp.check((select count(*) from public.custom_lists where name = 'Sam''s picks') = 0 and (select count(*) from public.favorites where volume_id = 'dune' and user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'deleting a profile deletes its lists and favourites');
reset role;

-- Goals and reading days: own profiles only, bounded additions -------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.reading_goals (profile_id, user_id, year, books) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 2026, 24);
select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 30, 0);
select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 45, 1);
select pg_temp.check((select minutes = 75 and books_finished = 1 from public.reading_days) and (select books = 24 from public.reading_goals), 'Ann sets a goal, and record_reading adds to her day');
select pg_temp.expect_error($$select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 61, 0)$$, 'more than an hour of reading in one call');
select pg_temp.expect_error($$select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 5, 2)$$, 'two finished books in one call');
select pg_temp.expect_error($$select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date - 10, 5, 0)$$, 'reading on a day far from today');
select pg_temp.expect_error($$insert into public.reading_goals (profile_id, user_id, year, books) values ((select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 2027, 0)$$, 'a goal of no books');
-- Reading stats (Phase 17): listening minutes and which book was finished.
select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 20, 0, 15);
select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 0, 1, 0, 'frankenstein');
select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 0, 1, 0, 'frankenstein');
select pg_temp.check((select minutes = 95 and listening_minutes = 15 and books_finished = 3 from public.reading_days)
  and (select count(*) = 1 from public.finished_books where volume_id = 'frankenstein'), 'record_reading keeps listening minutes and the finished book (once a day)');
select pg_temp.expect_error($$select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 5, 0, 6)$$, 'more listening than minutes');
select pg_temp.expect_error($$select public.record_reading((select id from public.reader_profiles where name = 'Ann'), current_date, 0, 1, 0, 'not a volume id!')$$, 'a finished book with a bad id');
select pg_temp.expect_error($$update public.finished_books set volume_id = 'dune'$$, 'changing a finished book');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.reading_goals) + (select count(*) from public.reading_days) + (select count(*) from public.finished_books) = 0, 'Ben cannot see Ann''s goals, reading days or finished books');
select pg_temp.expect_error('insert into public.finished_books (profile_id, user_id, volume_id, finished_on) values (' || quote_literal(:'ann_profile') || ', ''00000000-0000-0000-0000-00000000000a'', ''dune'', current_date)', 'recording a finished book on another account''s profile');
select pg_temp.expect_error('select public.record_reading(' || quote_literal(:'ann_profile') || ', current_date, 5, 0)', 'adding reading to another account''s profile');
select pg_temp.expect_error('insert into public.reading_goals (profile_id, user_id, year, books) values (' || quote_literal(:'ann_profile') || ', ''00000000-0000-0000-0000-00000000000a'', 2026, 5)', 'a goal on another account''s profile');
reset role;
set role anon;
select pg_temp.expect_error('select * from public.reading_days', 'anon reading reading days');
select pg_temp.expect_error('select * from public.finished_books', 'anon reading finished books');
select pg_temp.expect_error($$select public.record_reading(gen_random_uuid(), current_date, 5, 0)$$, 'anon recording reading');
reset role;

-- Book clubs: members only, joined by code ------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.book_clubs (id, owner_id, name, volume_id, starts_on, finishes_on, invite_code)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'Ann''s club', 'dracula', current_date, current_date + 30, 'AnnClub123');
insert into public.club_posts (club_id, user_id, chapter_index, body) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 0, 'Welcome');
select pg_temp.check((select count(*) from public.club_members where club_id = '00000000-0000-0000-0000-0000000000c1') = 1, 'the owner joins their own club');
select pg_temp.expect_error($$insert into public.book_clubs (owner_id, name, volume_id, starts_on, finishes_on, invite_code) values ('00000000-0000-0000-0000-00000000000a', 'Too long', 'dracula', current_date, current_date + 400, 'AnnClub999')$$, 'a club over a year long');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.book_clubs) + (select count(*) from public.club_posts) = 0, 'Ben cannot see a club he isn''t in');
select pg_temp.expect_error($$insert into public.club_posts (club_id, user_id, chapter_index, body) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 0, 'Hi')$$, 'posting in a club you aren''t in');
select pg_temp.check(public.join_club('WrongCode1') is null, 'a wrong code joins nothing');
select pg_temp.check(public.join_club('AnnClub123') = '00000000-0000-0000-0000-0000000000c1', 'the right code joins the club');
select pg_temp.check((select count(*) from public.club_posts) = 1 and (select count(*) from public.club_members) = 2, 'a member sees the posts and members');
-- Club notifications (Phase 19): unread posts since joining, read marks, own settings only.
select pg_temp.check((select count(*) from public.club_unread()) = 0, 'posts from before joining aren''t new');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.club_posts (club_id, user_id, chapter_index, body) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 3, 'Chapter 4 thoughts');
select pg_temp.check((select count(*) from public.club_unread()) = 0, 'your own posts are never new to you');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select chapter_index = 3 and posts = 1 from public.club_unread()), 'another member''s new post counts, with its chapter');
select public.mark_club_read('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from public.club_unread()) = 0, 'opening the club marks it read');
update public.club_members set notify = false where club_id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.check((select notify from public.club_members where user_id = '00000000-0000-0000-0000-00000000000b') = false
  and (select notify from public.club_members where user_id = '00000000-0000-0000-0000-00000000000a'), 'a member turns off their own alerts, not anyone else''s');
select pg_temp.expect_error($$update public.club_members set joined_at = now() - interval '1 year' where user_id = '00000000-0000-0000-0000-00000000000b'$$, 'changing when you joined');
-- Listen along (Phase 20): the host moves a session; members see it; a left one can be taken over.
insert into public.club_listening (club_id, host_id, position_seconds, playing) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 120, true);
update public.club_listening set position_seconds = 300, rate = 1.5 where club_id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.check((select position_seconds = 300 and rate = 1.5 from public.club_listening), 'Ben leads a session and moves it');
select pg_temp.expect_error($$insert into public.club_listening (club_id, host_id, position_seconds) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 0)$$, 'starting a session as someone else');
select pg_temp.expect_error($$update public.club_listening set rate = 5$$, 'a speed the player doesn''t offer');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from public.club_listening) = 1, 'other members see the session');
update public.club_listening set host_id = '00000000-0000-0000-0000-00000000000a', position_seconds = 0;
select pg_temp.check((select host_id = '00000000-0000-0000-0000-00000000000b' from public.club_listening), 'a member can''t take over a session that''s still going');
reset role;
-- (As the service role, make the session look left: nobody has moved it for three minutes.)
alter table public.club_listening disable trigger club_listening_set_updated_at;
update public.club_listening set updated_at = now() - interval '3 minutes';
alter table public.club_listening enable trigger club_listening_set_updated_at;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.club_listening set host_id = '00000000-0000-0000-0000-00000000000a', position_seconds = 0;
select pg_temp.check((select host_id = '00000000-0000-0000-0000-00000000000a' from public.club_listening), 'a member takes over a left session');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
delete from public.club_posts where user_id = '00000000-0000-0000-0000-00000000000a';
delete from public.book_clubs where id = '00000000-0000-0000-0000-0000000000c1';
delete from public.club_members where user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from public.club_posts) = 2 and (select count(*) from public.book_clubs) = 1 and (select count(*) from public.club_members) = 2, 'a member cannot delete others'' posts, the club, or the owner');
delete from public.club_members where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.book_clubs) = 0, 'a member can leave');
reset role;
set role anon;
select pg_temp.expect_error('select * from public.club_posts', 'anon reading club posts');
select pg_temp.expect_error($$select public.join_club('AnnClub123')$$, 'anon joining a club');
select pg_temp.expect_error('select * from public.club_unread()', 'anon counting club posts');
select pg_temp.expect_error('select * from public.club_listening', 'anon reading listening sessions');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
delete from public.book_clubs where id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.check((select count(*) from public.club_members where club_id = '00000000-0000-0000-0000-0000000000c1') = 0, 'deleting a club deletes its members and posts');
reset role;

-- Player settings, devices and handoffs: own account only --------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.reader_profiles set playback_speed = 1.5, player_volume = 40, player_muted = true, skip_forward_seconds = 30, auto_skip_intro = true where name = 'Ann';
select pg_temp.check((select playback_speed = 1.5 and player_volume = 40 and player_muted and skip_forward_seconds = 30 and auto_skip_intro from public.reader_profiles where name = 'Ann'), 'Ann saves her player settings');
select pg_temp.expect_error($$update public.reader_profiles set playback_speed = 1.1 where name = 'Ann'$$, 'a speed the player doesn''t offer');
select pg_temp.expect_error($$update public.reader_profiles set player_volume = 101 where name = 'Ann'$$, 'a volume over 100');
select pg_temp.expect_error($$update public.reader_profiles set skip_back_seconds = 7 where name = 'Ann'$$, 'a skip length the player doesn''t offer');
insert into public.listening_devices (id, user_id, label) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'Chrome on Windows'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000a', 'Safari on iPhone');
select public.touch_listening_device('00000000-0000-0000-0000-0000000000d1');
insert into public.playback_handoffs (user_id, profile_id, volume_id, position_seconds, from_label, to_device_id)
  values ('00000000-0000-0000-0000-00000000000a', (select id from public.reader_profiles where name = 'Ann'), 'dracula', 125, 'Chrome on Windows', '00000000-0000-0000-0000-0000000000d2');
update public.playback_handoffs set claimed_at = now() where to_device_id = '00000000-0000-0000-0000-0000000000d2';
select pg_temp.check((select claimed_at is not null from public.playback_handoffs), 'Ann sends a book to her other device, which picks it up');
select pg_temp.expect_error($$insert into public.listening_devices (id, user_id, label) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', '')$$, 'a device with no name');
select pg_temp.expect_error($$update public.playback_handoffs set position_seconds = 0$$, 'changing a handoff''s place (no column grant)');
reset role;
update public.listening_devices set last_seen_at = '2026-01-01' where id = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.listening_devices) + (select count(*) from public.playback_handoffs) = 0, 'Ben cannot see Ann''s devices or handoffs');
insert into public.listening_devices (id, user_id, label) values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000000b', 'Firefox on Linux');
select pg_temp.expect_error($$insert into public.playback_handoffs (user_id, profile_id, volume_id, position_seconds, from_label, to_device_id) values ('00000000-0000-0000-0000-00000000000b', (select id from public.reader_profiles limit 1), 'dracula', 0, 'Firefox on Linux', '00000000-0000-0000-0000-0000000000d2')$$, 'sending to another account''s device');
select pg_temp.expect_error('insert into public.playback_handoffs (user_id, profile_id, volume_id, position_seconds, from_label, to_device_id) values (''00000000-0000-0000-0000-00000000000b'', ' || quote_literal(:'ann_profile') || ', ''dracula'', 0, ''Firefox on Linux'', ''00000000-0000-0000-0000-0000000000d3'')', 'sending for another account''s profile');
select public.touch_listening_device('00000000-0000-0000-0000-0000000000d1');
reset role;
select pg_temp.check((select last_seen_at = '2026-01-01' from public.listening_devices where id = '00000000-0000-0000-0000-0000000000d1') and (select count(*) from public.listening_devices where user_id = '00000000-0000-0000-0000-00000000000a') = 2, 'Ben cannot check in or clear Ann''s devices');
set role anon;
select pg_temp.expect_error('select * from public.playback_handoffs', 'anon reading handoffs');
select pg_temp.expect_error($$select public.touch_listening_device(gen_random_uuid())$$, 'anon checking in a device');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
delete from public.listening_devices where id = '00000000-0000-0000-0000-0000000000d2';
select pg_temp.check((select count(*) from public.playback_handoffs) = 0, 'clearing a device clears its handoffs');
reset role;

-- Uploaded books (Phase 21): own account only, not on Kids profiles ------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.uploaded_books (id, profile_id, user_id, title, author, chapter_titles, chapter_words, words, storage_path)
values ('u-0123456789abcdef0123456789abcdef', (select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a',
        'My novel', 'Ann', array['One', 'Two'], array[1200, 900], 2100, '00000000-0000-0000-0000-00000000000a/u-0123456789abcdef0123456789abcdef.json');
select pg_temp.check((select count(*) from public.uploaded_books) = 1, 'Ann uploads a book to her profile');
select pg_temp.expect_error($$insert into public.uploaded_books (id, profile_id, user_id, title, chapter_titles, chapter_words, words, storage_path)
  values ('u-1123456789abcdef0123456789abcdef', (select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'Elsewhere', array['One'], array[10], 10,
  '00000000-0000-0000-0000-00000000000b/u-1123456789abcdef0123456789abcdef.json')$$, 'an upload whose file is in another account''s folder');
select pg_temp.expect_error($$insert into public.uploaded_books (id, profile_id, user_id, title, chapter_titles, chapter_words, words, storage_path)
  values ('not-an-upload-id', (select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'Bad id', array['One'], array[10], 10,
  '00000000-0000-0000-0000-00000000000a/not-an-upload-id.json')$$, 'an upload id in the wrong format');
select pg_temp.expect_error($$insert into public.uploaded_books (id, profile_id, user_id, title, chapter_titles, chapter_words, words, storage_path)
  values ('u-2123456789abcdef0123456789abcdef', (select id from public.reader_profiles where name = 'Ann'), '00000000-0000-0000-0000-00000000000a', 'Mismatch', array['One', 'Two'], array[10], 10,
  '00000000-0000-0000-0000-00000000000a/u-2123456789abcdef0123456789abcdef.json')$$, 'chapter titles and word counts that don''t match');
select pg_temp.expect_error($$update public.uploaded_books set title = 'Renamed'$$, 'changing an upload');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.uploaded_books) = 0, 'Ben cannot see Ann''s uploads');
select pg_temp.expect_error('insert into public.uploaded_books (id, profile_id, user_id, title, chapter_titles, chapter_words, words, storage_path) values (''u-3123456789abcdef0123456789abcdef'', ' || quote_literal(:'ann_profile')
  || ', ''00000000-0000-0000-0000-00000000000a'', ''Sneaky'', array[''One''], array[10], 10, ''00000000-0000-0000-0000-00000000000a/u-3123456789abcdef0123456789abcdef.json'')', 'uploading to another account''s profile');
delete from public.uploaded_books where id = 'u-0123456789abcdef0123456789abcdef';
reset role;
select pg_temp.check((select count(*) from public.uploaded_books) = 1, 'Ben cannot delete Ann''s upload');
insert into public.reader_profiles (account_id, name, age_rating, kids_consent_at) values ('00000000-0000-0000-0000-00000000000a', 'Kit', 'kids', now());
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$insert into public.uploaded_books (id, profile_id, user_id, title, chapter_titles, chapter_words, words, storage_path)
  values ('u-4123456789abcdef0123456789abcdef', (select id from public.reader_profiles where name = 'Kit'), '00000000-0000-0000-0000-00000000000a', 'Kit''s book', array['One'], array[10], 10,
  '00000000-0000-0000-0000-00000000000a/u-4123456789abcdef0123456789abcdef.json')$$, 'uploading to a Kids profile');
reset role;
delete from public.reader_profiles where name = 'Kit';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
reset role;
set role anon;
select pg_temp.expect_error('select * from public.uploaded_books', 'anon reading uploads');
reset role;

-- Staff roles and legal pages ------------------------------------------------
set role anon;
select pg_temp.check((select count(*) from public.legal_pages) = 13, 'anyone reads the legal pages');
select pg_temp.expect_error($$update public.legal_pages set title = 'Hacked' where slug = 'terms'$$, 'anon editing a legal page');
select pg_temp.expect_error('select * from public.staff_roles', 'anon reading staff roles');
select pg_temp.expect_error($$select public.grant_staff_role('a@test', 'admin')$$, 'anon granting a role');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.legal_pages set title = 'Not an editor' where slug = 'terms';
select pg_temp.check((select title from public.legal_pages where slug = 'terms') = 'Terms of Service' and not public.has_staff_role('editor'), 'a member without a role can''t edit');
select pg_temp.expect_error($$insert into public.staff_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'admin')$$, 'giving yourself a role');
select pg_temp.expect_error($$select public.grant_staff_role('a@test', 'admin')$$, 'a non-admin granting a role');
select pg_temp.expect_error('select * from public.staff_members()', 'a non-admin listing the team');
reset role;
insert into public.staff_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'admin');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check(public.grant_staff_role('B@Test', 'editor') = 'granted' and public.grant_staff_role('new.person@test', 'blog') = 'invited', 'an admin grants a role by email, or invites an email with no account');
select pg_temp.check((select count(*) = 2 from public.staff_members() where not invited) and (select roles = '{blog}' from public.staff_members() where invited), 'admins see the team and the invitations');
select pg_temp.expect_error($$select public.revoke_staff_role('a@test', 'admin')$$, 'removing the last admin');
update public.legal_pages set summary = 'Updated summary.' where slug = 'terms';
select pg_temp.check((select summary = 'Updated summary.' and updated_by = '00000000-0000-0000-0000-00000000000a' from public.legal_pages where slug = 'terms')
  and (select count(*) = 1 and bool_and(summary <> 'Updated summary.') from public.legal_page_revisions where slug = 'terms'), 'an admin edits a page; the old version is kept and the editor stamped');
select pg_temp.expect_error($$update public.legal_pages set sections = '[{"heading": "", "paragraphs": ["x"]}]' where slug = 'terms'$$, 'a section with no heading');
select pg_temp.expect_error($$update public.legal_pages set sections = '{"not": "a list"}' where slug = 'terms'$$, 'sections that aren''t a list');
select pg_temp.expect_error($$update public.legal_pages set slug = 'renamed' where slug = 'terms'$$, 'renaming a page');
select pg_temp.expect_error($$insert into public.legal_pages (slug, position, title, summary) values ('new', 9, 'New', 'New')$$, 'adding a page from the browser');
select pg_temp.expect_error($$delete from public.legal_pages where slug = 'terms'$$, 'deleting a page from the browser');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update public.legal_pages set summary = 'Edited by Ben.' where slug = 'help';
select pg_temp.check((select summary = 'Edited by Ben.' from public.legal_pages where slug = 'help') and (select count(*) = 1 from public.staff_roles), 'an editor edits pages and sees only their own role');
select pg_temp.expect_error($$select public.grant_staff_role('c@test', 'admin')$$, 'an editor granting a role');
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000e', 'New.Person@test', '{"display_name":"Nell","date_of_birth":"1990-01-01","terms_accepted":true}');
select pg_temp.check((select role = 'blog' from public.staff_roles where user_id = '00000000-0000-0000-0000-00000000000e') and (select count(*) = 0 from public.staff_invites), 'signing up picks up a waiting role');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.revoke_staff_role('b@test', 'editor');
select pg_temp.check((select count(*) = 0 from public.staff_members() where email = 'b@test'), 'an admin removes a role');
-- Admins are never billed: Ann's Standard plan became a complimentary Premium membership when she became an admin.
select pg_temp.check((select complimentary and plan_id = 'premium' and status = 'active' and billing_day is null from public.subscriptions), 'an admin sees a complimentary membership with no billing day');
select pg_temp.expect_error($$update public.subscriptions set complimentary = false$$, 'an admin changing their membership from the browser');
reset role;
update public.subscriptions set status = 'paused', billing_day = 5, cancel_at_period_end = true, stripe_subscription_id = 'sub_x'
 where user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select complimentary and status = 'active' and billing_day is null and not cancel_at_period_end and stripe_subscription_id is null
  from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000a'), 'an admin''s membership can''t be paused, cancelled or given billing, even by the server');
insert into public.subscriptions (user_id, plan_id, billing_day, renewal_terms_accepted_at, complimentary)
values ('00000000-0000-0000-0000-00000000000b', 'basic', 9, now(), true);
select pg_temp.check((select not complimentary and billing_day = 9 from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000b'), 'a member can''t be marked complimentary without the admin role');
delete from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect_error($$insert into public.subscriptions (user_id, plan_id) values ('00000000-0000-0000-0000-00000000000b', 'basic')$$, 'a paid plan without a billing day or renewal consent');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.grant_staff_role('b@test', 'admin');
reset role;
select pg_temp.check((select complimentary and plan_id = 'premium' from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000b'), 'granting admin starts a complimentary membership');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.revoke_staff_role('b@test', 'admin');
reset role;
select pg_temp.check(not exists (select 1 from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000b'), 'removing admin ends the complimentary membership: a plan must be chosen again');
delete from auth.users where id = '00000000-0000-0000-0000-00000000000e';

-- Two-step sign-in: with a verified factor, a password-only session reaches nothing of Ann's
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'Authenticator app', 'totp', 'verified', now(), now());
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}';
select pg_temp.check(not public.second_step_done(), 'a password-only session isn''t enough once two-step sign-in is on');
select pg_temp.check((select count(*) from public.reader_profiles) = 0, 'without the code, Ann sees none of her profiles');
select pg_temp.check((select count(*) from public.library_items) = 0, 'without the code, Ann sees none of her library');
select pg_temp.check((select count(*) from public.subscriptions) = 0, 'without the code, Ann can''t see her membership');
select pg_temp.check((select count(*) from public.profiles) > 0, 'display names stay public without the code');
select pg_temp.expect_error($$insert into public.logs (user_id, volume_id, body) values ('00000000-0000-0000-0000-00000000000a', 'abc', 'hi')$$, 'writing a log without the code');
select pg_temp.expect_error($$select public.join_club('ABCDEFGHIJ')$$, 'joining a club without the code');
select pg_temp.check(not public.has_staff_role('admin'), 'staff roles need the code too');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}';
select pg_temp.check(public.second_step_done(), 'the code completes sign-in');
select pg_temp.check((select count(*) from public.reader_profiles) > 0, 'with the code, Ann sees her profiles');
reset role;
reset request.jwt.claims;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check(public.second_step_done(), 'members without two-step sign-in are unaffected');
reset role;
delete from auth.mfa_factors where id = '00000000-0000-0000-0000-0000000000f1';

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
