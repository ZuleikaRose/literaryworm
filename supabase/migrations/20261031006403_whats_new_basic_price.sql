-- What's new: the new Basic price (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$New price for Basic$lw$, $lw$Basic is now $9.99 a month ($99.90 a year), for new memberships and gifts. If you're already a member, your price stays as it is.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$New price for Basic$lw$ and c.version = $lw$2026.10$lw$);
