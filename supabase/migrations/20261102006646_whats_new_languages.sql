-- The app in seven languages (src/lib/i18n.ts, src/data/i18n/*.json; the policies' note is 6645).
-- This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'feature', $lw$LiteraryWorm in seven languages$lw$, $lw$Choose Español, Français, Deutsch, Português, Italiano or Nederlands in the accessibility menu, and the whole app follows: menus, buttons, messages, the reader and player, car mode, My Library, Account, clubs and the plan FAQ. A visit starts in your browser's language. Dates and billing days follow the language too. Books stay in the language they were written in, the policies stay in English with a note in your language, and voice control in car mode still listens for English words.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$LiteraryWorm in seven languages$lw$ and c.version = '2026.11');
