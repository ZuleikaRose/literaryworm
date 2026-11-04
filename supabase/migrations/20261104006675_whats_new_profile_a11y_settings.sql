-- What's new: the accessibility menu's settings follow the profile (6673). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'feature', $lw$Accessibility settings follow your profile$lw$, $lw$The accessibility menu now remembers your choices for each profile: text size, theme, Lexend or OpenDyslexic, high contrast, underlined links, stopped animations and the read-along transcript's settings. A member's profile opens with them on every device, so you set them once.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Accessibility settings follow your profile$lw$ and c.version = '2026.11');
