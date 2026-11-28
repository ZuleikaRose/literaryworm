-- What's new: changing the email address. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-27'::date, '2026.11', 'feature', $lw$Change your email address$lw$, $lw$You can now change the email address of your account in Account → Sign-in. We send a link to your current address and one to the new one, and the change happens once you've followed both. Your old address gets a note when it's done, and your receipts move to the new address too.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Change your email address$lw$ and c.released_on = '2026-11-27');
