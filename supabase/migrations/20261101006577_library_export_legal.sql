-- Library export as CSV: the Privacy Policy and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Exports of your highlights and notes are made in your browser and downloaded to your device; they're never uploaded.$lw$, $lw$Exports of your highlights and notes are made in your browser and downloaded to your device; they're never uploaded. So are library exports for Goodreads and StoryGraph (a CSV of your books, shelves, star ratings and dates); we don't send them to either site.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Exports of your highlights and notes are made in your browser and downloaded to your device; they're never uploaded.$lw$) > 0
  and strpos(sections::text, $lw$library exports for Goodreads and StoryGraph$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$they're waiting in the recipient's library when they redeem it.$lw$, $lw$they're waiting in the recipient's library when they redeem it. To take your library elsewhere, choose Export for Goodreads or Export for StoryGraph in My Library: you get a CSV of your books, shelves, star ratings (Love it 5, Like it 4, Not for me 2) and dates, made on your device, to import there.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$they're waiting in the recipient's library when they redeem it.$lw$) > 0
  and strpos(sections::text, $lw$Export for Goodreads or Export for StoryGraph$lw$) = 0;
