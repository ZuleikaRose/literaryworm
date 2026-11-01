-- Reading plans (migration 6570): the Privacy Policy, Children's Privacy Notice and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$(for the book page's Your time with this book),$lw$, $lw$(for the book page's Your time with this book), reading plans (the day a profile chose to finish a book by, and where it was in the book when the plan started),$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$(for the book page's Your time with this book),$lw$) > 0
  and strpos(sections::text, $lw$reading plans (the day$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$to show it on the book's page.$lw$, $lw$to show it on the book's page. If it makes a reading plan, we keep the day it chose to finish the book by and where it was when the plan started.$lw$)::jsonb, updated_at = now()
where slug = $lw$childrens-privacy$lw$
  and strpos(sections::text, $lw$to show it on the book's page.$lw$) > 0
  and strpos(sections::text, $lw$If it makes a reading plan$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and Home says when some are due.$lw$, $lw$and Home says when some are due. On a book's page, Reading plan lets you pick a day to finish by: it works out about how many minutes (at your own pace) or pages a day get you there, and says whether you're on track, ahead or behind; Home lists your plans.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$and Home says when some are due.$lw$) > 0
  and strpos(sections::text, $lw$Reading plan lets you pick$lw$) = 0;
