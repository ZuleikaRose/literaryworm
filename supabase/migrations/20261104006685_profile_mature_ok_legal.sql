-- The age gate for books marked mature (6684): the Privacy Policy lists the confirmation among what's kept for a
-- profile. src/data/legalPages.json has the same. Added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$player settings, the app language and accessibility settings it chose, and whether it's set aside.$lw$, $lw$player settings, the app language and accessibility settings it chose, whether a grown-up profile has confirmed it's 18 or older to open books marked mature, and whether it's set aside.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$player settings, the app language and accessibility settings it chose, and whether it's set aside.$lw$) > 0;
