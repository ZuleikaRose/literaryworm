-- Gift books (migration 6574): the Privacy Policy, Return Policy and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$(and, for a gift that starts on a later day, when we reminded the buyer).$lw$, $lw$(and, for a gift that starts on a later day, when we reminded the buyer). A gift can come with up to 10 LiteraryWorm books the buyer picks: we keep which ones with the code, Stripe receives their ids with the payment, the email we send the recipient names them, and redeeming the gift adds them to the redeemer's library.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$(and, for a gift that starts on a later day, when we reminded the buyer).$lw$) > 0
  and strpos(sections::text, $lw$A gift can come with up to 10$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and then it renews monthly until you cancel.$lw$, $lw$and then it renews monthly until you cancel. Books that come with a gift are added to the library as Want to read when it's redeemed; they're LiteraryWorm titles, so reading and listening to them is part of the membership, not a separate purchase.$lw$)::jsonb, updated_at = now()
where slug = $lw$returns$lw$
  and strpos(sections::text, $lw$and then it renews monthly until you cancel.$lw$) > 0
  and strpos(sections::text, $lw$Books that come with a gift$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Home lists your plans.$lw$, $lw$Home lists your plans. When you buy a gift on Gifts, you can add up to 10 LiteraryWorm books to it (find a title, or add one of your lists); they're waiting in the recipient's library when they redeem it.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$Home lists your plans.$lw$) > 0
  and strpos(sections::text, $lw$add up to 10 LiteraryWorm books to it$lw$) = 0;
