-- Smart lists in My Library: Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$for members who turn on Show my place to this club; it's off until you turn it on.$lw$, $lw$for members who turn on Show my place to this club; it's off until you turn it on. My Library → Smart lists fill themselves: Almost there (past halfway), Waiting for you (started, not opened for 30 days), From authors you follow and Loved it.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$for members who turn on Show my place to this club; it's off until you turn it on.$lw$) > 0
  and strpos(sections::text, $lw$Smart lists$lw$) = 0;
