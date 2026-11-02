-- Car mode: on phones and in the installed app, the same buttons in the same order as on a wide
-- screen, and it fits a phone on its side (CSS only, nothing stored). This adds its What's new
-- entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'fix', $lw$Car mode looks the same on phones and in the app$lw$, $lw$On a phone, and in the installed app, car mode now has the same buttons in the same order as on a bigger screen: Back, Play and Forward side by side with Play in the middle, and Previous and Next chapter under them. With the phone on its side in a dashboard mount, everything fits on one screen.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Car mode looks the same on phones and in the app$lw$ and c.version = '2026.11');
