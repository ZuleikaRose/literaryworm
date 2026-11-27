-- What's new: the password forms now state and check Supabase Auth's character rules. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-27'::date, '2026.11', 'update', $lw$Password rules shown as they are$lw$, $lw$New passwords need 15 to 64 characters with a lowercase letter, a capital, a number and a symbol such as ! ? # or %. The sign-up, password reset and Change password forms now say so and check it before sending, instead of the account service turning the password down afterwards. Passwords you already use keep working.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Password rules shown as they are$lw$ and c.released_on = '2026-11-27');
