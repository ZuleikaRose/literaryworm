-- Club polls: Help explains them and the Privacy Policy says members see each other's votes (src/data/legalPages.json
-- has the same). Each change is made once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$code, and you get spoiler-safe posts by chapter, meetings and shared highlights."$lw$, $lw$code, and you get spoiler-safe posts by chapter, meetings and shared highlights.", "A club's owner can ask What to read next on the club's page: offer two to five LiteraryWorm books and members vote. Everyone in the club sees the votes and can change theirs until the owner closes the poll. The book with the most votes wins (a tie goes to the one offered first), and Start a club with it begins a club for it."$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$code, and you get spoiler-safe posts by chapter, meetings and shared highlights."$lw$) > 0
  and strpos(sections::text, $lw$ask What to read next$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$book club posts and whether you're coming to a club's meetings (seen by the club's members)$lw$, $lw$book club posts, whether you're coming to a club's meetings and your votes in its polls (seen by the club's members)$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$book club posts and whether you're coming to a club's meetings (seen by the club's members)$lw$) > 0
  and strpos(sections::text, $lw$your votes in its polls$lw$) = 0;
