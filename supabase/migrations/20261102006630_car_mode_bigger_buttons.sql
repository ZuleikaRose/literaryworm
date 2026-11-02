-- Car mode: bigger buttons on several rows on phones and tablets (CSS only, nothing stored). This
-- adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'update', $lw$Bigger car mode buttons on phones and tablets$lw$, $lw$On phones and tablets, in the browser or the installed app, online or offline, car mode now fills the screen with bigger buttons, icons and words. Held upright, Back and Forward are on the first row, Play goes across the middle, and Previous and Next chapter are below. A tablet on its side has two rows with Play down the middle, and a phone on its side has all five in one tall row.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Bigger car mode buttons on phones and tablets$lw$ and c.version = '2026.11');
