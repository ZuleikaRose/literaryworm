-- What's new: Log out on every other device (Account → Sign-in) and the live password checklist. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-27'::date, '2026.11', 'update', $lw$A checklist as you choose a password$lw$, $lw$When you choose a new password, on sign-up, password reset or Change password, the form now ticks off each rule as you type: 15 to 64 characters, a lowercase letter, a capital, a number and a symbol.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A checklist as you choose a password$lw$ and c.released_on = '2026-11-27');

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-27'::date, '2026.11', 'feature', $lw$Log out on every other device$lw$, $lw$Account → Sign-in now shows where you're logged in: the devices that have had LiteraryWorm open in the last day. If you lose a phone or forget to log out of a shared computer, Log out on every other device logs them all out and stops their notifications, while you stay logged in where you are.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Log out on every other device$lw$ and c.released_on = '2026-11-27');
