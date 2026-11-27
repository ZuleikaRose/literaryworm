-- What's new: Cloudflare Turnstile on the log-in and sign-up forms. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-27'::date, '2026.11', 'update', $lw$A security check when you log in or sign up$lw$, $lw$The log-in and sign-up forms, and asking for a password reset or the confirmation email again, now show a security check from Cloudflare Turnstile, to keep bots from guessing passwords and making accounts. It usually finishes on its own. The demo doesn't need it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A security check when you log in or sign up$lw$ and c.released_on = '2026-11-27');
