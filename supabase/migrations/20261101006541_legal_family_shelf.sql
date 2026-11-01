-- The family shelf (migration 6539): the Privacy Policy and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$until you turn them off there or log out on it.$lw$, $lw$until you turn them off there or log out on it. Grown-up and teen profiles can put catalog books on a family shelf for the household; we keep which books, which profile added each and when, until they're taken off or the account is deleted.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$until you turn them off there or log out on it.$lw$) > 0
  and strpos(sections::text, $lw$family shelf$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$add LiteraryWorm to your Home Screen first (Share, then Add to Home Screen) and turn them on in the app.$lw$, $lw$add LiteraryWorm to your Home Screen first (Share, then Add to Home Screen) and turn them on in the app. Grown-up and teen profiles can put a book on the family shelf from its page; it shows on Home for everyone at home, and Kids profiles see only the books their rating already allows.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$add LiteraryWorm to your Home Screen first (Share, then Add to Home Screen) and turn them on in the app.$lw$) > 0
  and strpos(sections::text, $lw$family shelf$lw$) = 0;
