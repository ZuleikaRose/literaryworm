-- Voice control in car mode (browser only, nothing stored; the policies are 6634). This adds its
-- What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'feature', $lw$Voice control in car mode$lw$, $lw$In car mode, turn on Voice control and say Play, Pause, Back, Forward, Next chapter, Previous chapter or Exit car mode, with a length if you like (“back 30 seconds”). It's off until you turn it on, listens only while car mode is open and on screen, and your browser's own speech service hears the words; LiteraryWorm keeps nothing. Not on Kids profiles.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Voice control in car mode$lw$ and c.version = '2026.11');
