-- What's new: Before you cancel. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Before you cancel$lw$, $lw$Cancelling in Account → Plan and billing now asks why you're leaving, if you'd like to say, and suggests something that might help instead: pausing on monthly billing, a smaller plan, your own uploads, the Help Center, or once per account a month's credit if you stay. You can always cancel anyway, and the 48-hour rule and no-refunds policy don't change.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Before you cancel$lw$ and c.released_on = '2026-11-07');
