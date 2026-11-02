-- Stronger high contrast (CSS and the starting settings only, nothing stored; the Accessibility Policy
-- is 6643). This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'update', $lw$Stronger high contrast$lw$, $lw$High contrast in the accessibility menu now turns the app black or white, with every text colour at the WCAG AAA level, stronger edges on buttons and fields, and underlined links. It's on from the start when your device asks for more contrast, and Windows contrast themes keep every button, switch and progress bar visible.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Stronger high contrast$lw$ and c.version = '2026.11');
