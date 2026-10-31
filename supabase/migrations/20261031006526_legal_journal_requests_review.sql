-- Book requests, word review and the reading journal (src/data/legalPages.json has the same change):
-- the Privacy Policy and the Children's Privacy Notice say they're kept. A page an editor has
-- reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$the words you save from the dictionary (with the sentence you met them in)$lw$, $lw$the words you save from the dictionary (with the sentence you met them in and when each is next due for review), your private reading journal (dated entries about a book that only your account sees)$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$the words you save from the dictionary (with the sentence you met them in)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$highlights, saved words, lists,$lw$, $lw$highlights, journal, saved words, lists,$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$highlights, saved words, lists,$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$the words it saves from the dictionary, its chapter quiz scores (which you can see in Account),$lw$, $lw$the words it saves from the dictionary, its private reading journal, the books it asks a grown-up for and your answers (which you give and can see in Account), its chapter quiz scores (which you can see in Account),$lw$)::jsonb, updated_at = now()
where slug = $lw$childrens-privacy$lw$
  and strpos(sections::text, $lw$the words it saves from the dictionary, its chapter quiz scores (which you can see in Account),$lw$) > 0;
