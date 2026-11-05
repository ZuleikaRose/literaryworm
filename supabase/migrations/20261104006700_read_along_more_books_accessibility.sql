-- The Accessibility Policy's read-along note now names all eight books with an alignment file (public/alignments).
-- Same text as src/data/legalPages.json, matched as stored. Changed once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$For Alice's Adventures in Wonderland, Frankenstein and Pride and Prejudice it shows the book's own text$lw$, $lw$For Alice's Adventures in Wonderland, Through the Looking-Glass, Frankenstein, Pride and Prejudice, A Christmas Carol, The Wonderful Wizard of Oz, Dr Jekyll and Mr Hyde and The Call of the Wild it shows the book's own text$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$For Alice's Adventures in Wonderland, Frankenstein and Pride and Prejudice it shows the book's own text$lw$) > 0;
