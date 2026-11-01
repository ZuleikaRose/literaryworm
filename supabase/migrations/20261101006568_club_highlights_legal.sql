-- Shared highlights in clubs (migration 6565): the Privacy Policy, Terms and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$turning it off hides it again.$lw$, $lw$turning it off hides it again. If you share one of your highlights with a book club, its members see the passage, its chapter and colour, your display name and, if you choose, your note, until you stop sharing it, delete the highlight or leave the club.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$turning it off hides it again.$lw$) > 0
  and strpos(sections::text, $lw$share one of your highlights with a book club$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$book club posts (seen by the club's members)$lw$, $lw$book club posts (seen by the club's members), highlights you share with a club (seen by its members)$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$book club posts (seen by the club's members)$lw$) > 0
  and strpos(sections::text, $lw$highlights you share with a club$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$it's off until you turn it on.$lw$, $lw$it's off until you turn it on. Under a club's discussion, Shared highlights shows passages members marked in the book; ones from chapters you haven't reached stay hidden until you choose to see them. Share one of yours from the list there, with or without its note, and stop sharing it whenever you like.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$it's off until you turn it on.$lw$) > 0
  and strpos(sections::text, $lw$Shared highlights shows$lw$) = 0;
