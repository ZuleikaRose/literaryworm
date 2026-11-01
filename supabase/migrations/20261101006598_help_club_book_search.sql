-- Help (Book clubs on your own books): find the club's book by title, author or ISBN, sort it and
-- filter by series. src/data/legalPages.json has the same. Skipped where an editor has reworded it.

update public.legal_pages
set sections = replace(sections::text, $lw$When you start a club in My Library → Clubs, choose My uploads under Book from and search by title or author to find it.$lw$, $lw$When you start a club in My Library → Clubs, choose LiteraryWorm books or My uploads under Book from, then find the book by title, author or ISBN (an ISBN is looked up on Google Books and matched by title and author). Sort the list by title, author, numbers first or series in reading order, and filter it to one series.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$ and strpos(sections::text, $lw$When you start a club in My Library → Clubs, choose My uploads under Book from and search by title or author to find it.$lw$) > 0;
