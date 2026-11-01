-- Where everyone is in a club (migration 6544): the Privacy Policy and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$until they're taken off or the account is deleted.$lw$, $lw$until they're taken off or the account is deleted. In a book club, if you turn on Show my place to this club, its members see the chapter you've reached in the club's book, how far through it you are and when you last read; turning it off hides it again.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$until they're taken off or the account is deleted.$lw$) > 0
  and strpos(sections::text, $lw$Show my place$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and Kids profiles see only the books their rating already allows.$lw$, $lw$and Kids profiles see only the books their rating already allows. On a book club's page, Where everyone is shows the chapter each member has reached, for members who turn on Show my place to this club; it's off until you turn it on.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$and Kids profiles see only the books their rating already allows.$lw$) > 0
  and strpos(sections::text, $lw$Where everyone is$lw$) = 0;
