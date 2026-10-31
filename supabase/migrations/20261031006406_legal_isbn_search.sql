-- Search by ISBN (src/data/legalPages.json has the same change): the Privacy Policy says an ISBN,
-- like search words, is what our server sends Google Books. A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$our server sends it search words, book ids$lw$, $lw$our server sends it search words or an ISBN, book ids$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$our server sends it search words, book ids$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$which sends only the search words, book ids$lw$, $lw$which sends only the search words or ISBN, book ids$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$which sends only the search words, book ids$lw$) > 0;
