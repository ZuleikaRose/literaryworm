-- What's new: the free week (6708) and natural voices in more languages, offline and in step. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-06'::date, '2026.11', 'feature', $lw$Try LiteraryWorm free for 7 days$lw$, $lw$Your first membership now starts with 7 days free, on any plan. You add a card at checkout, but nothing is charged until the week ends, and if you cancel in Account before then you won't be charged at all. Account shows when your free week ends.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Try LiteraryWorm free for 7 days$lw$ and c.version = '2026.11');

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-06'::date, '2026.11', 'feature', $lw$Natural voices: more languages, offline and in step$lw$, $lw$Natural voices for your uploads now read French, German, Spanish, Italian, Portuguese and Dutch books in their own language. Account → This month shows how much of your natural-voice reading is left, and the bell tells you when most is used. Parts you've played stay on your device to listen offline, the next chapter is voiced ahead on Wi-Fi, and the read-along follows each sentence.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Natural voices: more languages, offline and in step$lw$ and c.version = '2026.11');
