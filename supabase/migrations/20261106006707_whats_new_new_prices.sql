-- What's new: the prices from migration 6706. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-06'::date, '2026.11', 'update', $lw$New prices$lw$, $lw$From today, Basic is $30.00 a month ($300.00 a year), Standard $40.00 ($400.00) and Premium $50.00 ($500.00); paying yearly still gets two months free. Every plan keeps its profiles, listening hours, offline devices and natural-voice hours for your uploads, and Premium has up to 12 hours a month of Google's Chirp 3 HD voices. If you're already a member, your price stays as it is.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$New prices$lw$ and c.released_on = '2026-11-06');
