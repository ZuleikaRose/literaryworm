-- The Accessibility Policy's read-along note: Alice, Frankenstein and Pride and Prejudice now show the book's own
-- text timed to the LibriVox recording (public/alignments). Same text as src/data/legalPages.json, matched as stored.
-- Changed once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$The read-along transcript for some titles is sample text rather than the exact recording, and is hidden while a real recording plays.$lw$, $lw$The read-along transcript is sample text for titles without a public-domain text. For Alice's Adventures in Wonderland, Frankenstein and Pride and Prejudice it shows the book's own text, timed to the LibriVox recording; for the other LibriVox recordings it's hidden while the recording plays.$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$The read-along transcript for some titles is sample text rather than the exact recording, and is hidden while a real recording plays.$lw$) > 0;
