-- Help: the 64 genres (every top-level Google Books subject), a paragraph after the one about Keep discovering.
-- Same text as src/data/legalPages.json, matched as stored (the closing quote of that paragraph, unescaped).
-- Added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Logged in, Keep discovering on Home runs on from one genre into the next."$lw$, $lw$Logged in, Keep discovering on Home runs on from one genre into the next.", "There are 64 genres to browse and search by: the main ones, such as Fantasy, Mystery and Romance, and every subject Google Books files books under, from Antiques & Collectibles and Cooking to Travel and True Crime. Kids profiles see the genres with books chosen for them."$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$Logged in, Keep discovering on Home runs on from one genre into the next."$lw$) > 0
  and strpos(sections::text, $lw$There are 64 genres$lw$) = 0;
