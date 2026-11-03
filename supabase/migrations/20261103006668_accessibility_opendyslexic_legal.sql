-- The accessibility menu has an OpenDyslexic switch for the whole app and scrolls on a small screen: the
-- Accessibility Policy says so. src/data/legalPages.json has the same. Added once; a page an editor has
-- reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$The accessibility menu at the top of every page changes text size, theme (dark or light), an easier-to-read font, high contrast, underlined links and reduced motion. Your choices last for the visit.$lw$, $lw$The accessibility menu at the top of every page changes text size, theme (dark or light), the font (Lexend, or OpenDyslexic, a typeface made for readers with dyslexia), high contrast, underlined links and reduced motion. It scrolls inside the window on a small screen. Your choices last for the visit.$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$The accessibility menu at the top of every page changes text size, theme (dark or light), an easier-to-read font, high contrast, underlined links and reduced motion. Your choices last for the visit.$lw$) > 0;
