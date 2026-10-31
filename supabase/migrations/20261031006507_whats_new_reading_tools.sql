-- What's new: My words, export, series, time left, Up next, badges, shortcuts, chapter quizzes,
-- following readers, car mode and casting, eight highlight colours, sorting My library, author and ISBN
-- in the header search (src/data/changelog.json has the same).
-- Data only; each skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Eight highlight colours$lw$, $lw$Highlights now come in eight colours: orange, purple, teal and red join yellow, green, blue and pink.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Eight highlight colours$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Keyboard shortcuts in the reader$lw$, $lw$Press ? in the reader to see its shortcuts: the arrows turn pages, C opens the chapters, N your notes, B bookmarks the page, D the dictionary and T the display settings.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Keyboard shortcuts in the reader$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Badges$lw$, $lw$My Library → Badges shows 14 milestones, from a first finish and a week in a row to Explorer, Classic reader and Series complete, with progress towards each. A new badge shows in the bell for a week.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Badges$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Time left$lw$, $lw$The reader shows about how long the rest of the chapter and the book will take, at your own pace, which it learns as you read (and remembers on all your devices). The player shows the time left at your speed.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Time left$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Export your notes and highlights$lw$, $lw$Save a book's notes and highlights as Markdown or plain text from the reader's Notes and highlights, or every book's at once from My Library → Notes. The file is made on your device; nothing is uploaded.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Export your notes and highlights$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$My words$lw$, $lw$In the reader's dictionary, Keep in My words saves a word with its meaning and the sentence it came from. Find them in My Library → Words, and Practise them as flashcards: the word first, then its meaning, I knew it or Not yet.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$My words$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Series pages$lw$, $lw$Books in a series now say so (Book 2 of 6 in Anne of Green Gables) and link to the series page, with every book in reading order and where you are. Finish one and Home's Continue the series row offers the next; the end of a book names it too. 40 series to start, from Oz and Sherlock Holmes to Barsetshire.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Series pages$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Up next$lw$, $lw$Line up audiobooks with Add to Up next on a book's page. When a book finishes, the player and the mini-player offer the next one, from your place in it. Reorder or remove them in My Library → Up next.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Up next$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Car mode and casting$lw$, $lw$The player has a Car mode: five big buttons, the title and the time left, and the screen kept on. Where your browser can, Cast to a speaker or TV plays a classic's recording on a Chromecast or AirPlay device. Both are in the mini-player's More menu too.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Car mode and casting$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Chapter quizzes$lw$, $lw$In the reader of a classic, Chapter quiz asks a few questions about the chapter you're on, with the answer explained after each, for every profile, Kids included. The questions are written by AI from that chapter only, so nothing later is given away, and nothing about you is sent. Grown-ups see a Kids profile's quizzes in Account → Family.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Chapter quizzes$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Follow other readers$lw$, $lw$Members can now follow other readers who share their logs. Turn on Let other readers follow me in Account → Preferences to get a reader page with the logs you publish; on a book's page, a sharing reader's name opens theirs, with Follow. Their newest logs are in My Library → Readers. Only you see who you follow, your library and reading stay private, and turning your page off removes your followers.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Follow other readers$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Sort My library$lw$, $lw$Sort My library by title (A–Z or Z–A), with titles that start with a number first, by author, by when you added a book or last changed it, or by when it was published. Uploads sort by the date you uploaded them. Your choice stays in the address with the Show filter.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Sort My library$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Search by author or ISBN from the header$lw$, $lw$The search box at the top of every page now has Title, Author and ISBN (ISBN for grown-up and teen profiles, since it looks on Google Books), so you can search the way you like without opening Search first.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Search by author or ISBN from the header$lw$ and c.version = $lw$2026.10$lw$);
