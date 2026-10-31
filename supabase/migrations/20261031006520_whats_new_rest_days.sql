-- What's new: rest days for reading streaks (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Rest days for your streak$lw$, $lw$Every profile gets two rest days a month. Miss a day and a rest day is used for you, so your reading streak keeps going. Goals shows how many are left this month and which days your streak rested on, and the evening reminder only comes once they're used up.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Rest days for your streak$lw$ and c.version = $lw$2026.10$lw$);
