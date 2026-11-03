-- The accessibility menu scrolls in any window too short to show it all, not only on small screens: Help and the
-- Accessibility Policy say so. src/data/legalPages.json has the same. A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$On a small screen the menu scrolls, so Reset to defaults is always at its end.$lw$, $lw$In any window too short to show it all, the menu scrolls, so Reset to defaults is always at its end.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$On a small screen the menu scrolls, so Reset to defaults is always at its end.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$It scrolls inside the window on a small screen.$lw$, $lw$It scrolls inside any window too short to show it all.$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$It scrolls inside the window on a small screen.$lw$) > 0;
