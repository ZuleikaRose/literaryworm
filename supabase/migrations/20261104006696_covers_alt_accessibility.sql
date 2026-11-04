-- The Accessibility Policy: book covers now have text alternatives ("Cover of …"). Same text as src/data/legalPages.json, matched as stored.
-- Changed once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Pictures that carry meaning, like shared quote cards, have text alternatives; decorative covers are hidden from screen readers and their titles are always written nearby.$lw$, $lw$Book covers are described as the cover of their title, and shared pictures, like quote cards, by what they show; drawn covers, which only repeat the title written beside them, are hidden from screen readers.$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$Pictures that carry meaning, like shared quote cards, have text alternatives; decorative covers are hidden from screen readers and their titles are always written nearby.$lw$) > 0;
