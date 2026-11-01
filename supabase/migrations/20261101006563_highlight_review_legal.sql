-- Highlights review (migration 6562): the Privacy Policy and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$bookmarks, highlights and notes$lw$, $lw$bookmarks, highlights and notes (with when each highlight is next due for review)$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$bookmarks, highlights and notes$lw$) > 0
  and strpos(sections::text, $lw$each highlight is next due$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$written by AI from the chapters before yours only.$lw$, $lw$written by AI from the chapters before yours only. My Library → Notes has Review for highlights: each comes back the day after you make it, then after 1, 3, 7, 14, 30 and 60 days while it still matters, up to 10 a day, and Home says when some are due.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$written by AI from the chapters before yours only.$lw$) > 0
  and strpos(sections::text, $lw$Review for highlights$lw$) = 0;
