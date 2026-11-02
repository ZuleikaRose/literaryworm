-- Stronger high contrast: the Accessibility Policy says what it does, that it follows the device's contrast setting
-- and that Windows contrast themes work (src/data/legalPages.json has the same). Added once; a page an editor has
-- reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$ contrast, underlined links and reduced motion. Your choices last for the visit."$lw$, $lw$ contrast, underlined links and reduced motion. Your choices last for the visit.", "High contrast turns the app black or white, with text at the WCAG AAA level (7:1) and stronger edges on buttons and fields, and links underlined. It's on from the start when your device asks for more contrast (Increase contrast on iPhone, iPad and Mac). With a Windows contrast theme, buttons, switches and progress bars keep their edges and the chosen option is highlighted."$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$ contrast, underlined links and reduced motion. Your choices last for the visit."$lw$) > 0
  and strpos(sections::text, $lw$High contrast turns the app black or white$lw$) = 0;
