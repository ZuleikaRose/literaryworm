-- What's new: the new Standard and Premium prices (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$New prices for Standard and Premium$lw$, $lw$Standard is now $14.99 a month ($149.90 a year) and Premium $24.99 a month ($249.90 a year), for new memberships and gifts. Basic stays at $7.99. If you're already a member, your price stays as it is.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$New prices for Standard and Premium$lw$ and c.version = $lw$2026.10$lw$);
