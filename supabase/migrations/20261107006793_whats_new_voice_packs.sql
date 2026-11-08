-- What's new: Buy more natural-voice hours. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Buy more natural-voice hours$lw$, $lw$When your plan's natural-voice hours aren't enough, buy 5 more hours for $14.99 or 10 for $24.99 in Account → Plan and billing. They're paid once, used only after the month's plan hours, carry over from month to month and last 12 months.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Buy more natural-voice hours$lw$ and c.released_on = '2026-11-07');
