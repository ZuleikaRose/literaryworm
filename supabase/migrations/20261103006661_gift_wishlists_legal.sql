-- Gift wishlists: a shared list's page offers Give this list as a gift. Help says how, and the Privacy Policy
-- that anyone with a list's link can buy a gift from it. src/data/legalPages.json has the same. Added once; a
-- page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$they're waiting in the recipient's library when they redeem it."$lw$, $lw$they're waiting in the recipient's library when they redeem it.", "A list you share by link is a wishlist too: its page has Give this list as a gift, which opens Gifts with up to 10 of its LiteraryWorm books already picked. Share a list in My Library → Lists to let family and friends know what you'd like."$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$they're waiting in the recipient's library when they redeem it."$lw$) > 0
  and strpos(sections::text, $lw$A list you share by link is a wishlist too$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Lists you share can be read by anyone with the link.$lw$, $lw$Lists you share can be read by anyone with the link, who can also buy you a gift membership that comes with their LiteraryWorm books.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Lists you share can be read by anyone with the link. Staff$lw$) > 0;
