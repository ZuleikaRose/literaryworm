-- The accessibility menu's settings are kept per profile (6673): the Privacy Policy and Cookie Policy list them among
-- what's kept, and the Accessibility Policy says a member's profile keeps them on every device. src/data/legalPages.json
-- has the same. Added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$player settings, the app language it chose, and whether it's set aside.$lw$, $lw$player settings, the app language and accessibility settings it chose, and whether it's set aside.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$player settings, the app language it chose, and whether it's set aside.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$quiz scores, player settings, club activity$lw$, $lw$quiz scores, player and accessibility settings, club activity$lw$)::jsonb, updated_at = now()
where slug = $lw$cookies$lw$
  and strpos(sections::text, $lw$quiz scores, player settings, club activity$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$It scrolls inside any window too short to show it all. Your choices last for the visit.$lw$, $lw$It scrolls inside any window too short to show it all. A member's profile keeps your choices on every device; otherwise they last for the visit.$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$It scrolls inside any window too short to show it all. Your choices last for the visit.$lw$) > 0;
