-- What's new: bedtime for Kids profiles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Bedtime for Kids profiles$lw$, $lw$Grown-ups can now set a bedtime for a Kids profile in its profile editor, from 7pm to 10pm, and when reading starts again in the morning. From bedtime until then, books and audiobooks show Time for bed, on that device's clock, and the place is saved. The account password allows 15 more minutes.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Bedtime for Kids profiles$lw$ and c.version = $lw$2026.11$lw$);
