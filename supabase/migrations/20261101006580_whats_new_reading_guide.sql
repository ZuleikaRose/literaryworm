-- What's new: opendyslexic, a reading ruler and line focus (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$OpenDyslexic, a reading ruler and line focus$lw$, $lw$The reader's Display settings now offer OpenDyslexic, a font made for readers with dyslexia, and a Reading guide: a ruler that marks the line you're on, or line focus, which dims everything but three lines. It follows your pointer or a tap, and J and K move it a line.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$OpenDyslexic, a reading ruler and line focus$lw$ and c.version = $lw$2026.11$lw$);
