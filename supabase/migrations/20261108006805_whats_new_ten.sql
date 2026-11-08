-- What's new: Right to left, mirrored. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'update', $lw$Right to left, mirrored$lw$, $lw$With the app in Arabic, every page now mirrors properly, from the header and menus to the reader, the player and its chapter marks, and book text follows its own direction.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Right to left, mirrored$lw$ and c.released_on = '2026-11-08');
-- What's new: Text spacing, and Read aloud speed in the reader. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'update', $lw$Text spacing, and Read aloud speed in the reader$lw$, $lw$The accessibility menu has Text spacing: Wide, or Wider, which adds the letter, word, line and paragraph spacing WCAG asks pages to cope with. While Read aloud is on, the reader's top bar has its speed.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Text spacing, and Read aloud speed in the reader$lw$ and c.released_on = '2026-11-08');
-- What's new: Continue on your phone. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Continue on your phone$lw$, $lw$In the reader, the player or the mini-player's More menu, Continue on your phone shows a code: scan it with your phone's camera and the book opens at the same page or moment. The code is made on your device.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Continue on your phone$lw$ and c.released_on = '2026-11-08');
-- What's new: Your club's year together. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Your club's year together$lw$, $lw$In December and January a club's page shows its year: posts, meetings held, highlights shared, how many members posted and the chapter talked about most, counted only up to your own chapter.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Your club's year together$lw$ and c.released_on = '2026-11-08');
-- What's new: Club polls can offer uploads. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'update', $lw$Club polls can offer uploads$lw$, $lw$What to read next can offer the owner's own uploaded books beside LiteraryWorm titles. Only the title and author are shown; each member reads their own copy.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Club polls can offer uploads$lw$ and c.released_on = '2026-11-08');
-- What's new: A speed for each character. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$A speed for each character$lw$, $lw$Under Who reads whom, give a speaker their own pace, from 0.8× to 1.2× of the narration, for a character who should talk slowly or quickly. It follows the profile to every device.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A speed for each character$lw$ and c.released_on = '2026-11-08');
-- What's new: Give natural-voice hours. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Give natural-voice hours$lw$, $lw$Gifts has a third choice: 5 hours of natural-voice reading for $14.99 or 10 for $24.99, for a member's uploads. They're redeemed in Account, used after the month's plan hours, and last 12 months.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Give natural-voice hours$lw$ and c.released_on = '2026-11-08');
-- What's new: A monthly share for each profile. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$A monthly share for each profile$lw$, $lw$In the profile editor a grown-up can give a profile its own share of the month's audiobook listening and natural-voice reading. When it's used, that profile pauses and the rest of the household carries on.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A monthly share for each profile$lw$ and c.released_on = '2026-11-08');
-- What's new: Natural voices for Kids profiles. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Natural voices for Kids profiles$lw$, $lw$A grown-up can now turn on natural voices for a Kids profile in its profile editor, with the account password, so children can hear their uploaded books read by a natural voice.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Natural voices for Kids profiles$lw$ and c.released_on = '2026-11-08');
