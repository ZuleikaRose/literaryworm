-- What's new: emails in the member's language. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'feature', $lw$Emails in your language$lw$, $lw$Our emails now come in the language you use LiteraryWorm in: book-out alerts, club reminders and digests, the Kids reading report, your year in reading, gifts, log-in alerts and the rest. Choose a different one under Language for emails in Account → Preferences. Book titles, names and What's new entries stay as they're written.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Emails in your language$lw$ and c.released_on = '2026-11-28');
