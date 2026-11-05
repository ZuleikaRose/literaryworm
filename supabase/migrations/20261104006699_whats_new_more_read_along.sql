-- What's new: five more read-along books, and the demo's sample reminder. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'update', $lw$More books to read along with$lw$, $lw$Five more classics now show the book's own words as the LibriVox recording plays, each sentence marked as it's read: Through the Looking-Glass, A Christmas Carol, The Wonderful Wizard of Oz, Dr Jekyll and Mr Hyde and The Call of the Wild. That makes eight, with Alice's Adventures in Wonderland, Frankenstein and Pride and Prejudice. The demo also has a reminder set for a sample upcoming book, so you can see how Remind me works.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More books to read along with$lw$ and c.version = '2026.11');
