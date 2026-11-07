-- What's new: Certificates for young readers. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Certificates for young readers$lw$, $lw$Kids profiles can now print a certificate with their name for every badge they earn and for reading 7, 14, 30, 100 or 365 days in a row. Find them in My Library → Badges.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Certificates for young readers$lw$ and c.released_on = '2026-11-07');
