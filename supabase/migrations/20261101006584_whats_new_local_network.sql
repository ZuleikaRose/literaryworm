-- What's new: help when logging in doesn't respond (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$Help when logging in doesn't respond$lw$, $lw$If Log in or Log in with a passkey does nothing, check your browser's site settings: LiteraryWorm never needs access to your local network, and allowing it can stop logging in from working. Help, the log-in page, the Privacy Policy and the Cookie Policy now say how to turn it off.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Help when logging in doesn't respond$lw$ and c.version = $lw$2026.11$lw$);
