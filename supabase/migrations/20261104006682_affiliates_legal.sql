-- The affiliate program (6679): the Terms (30. Membership) set out its rules, the Privacy Policy says what's kept for
-- affiliates and the people who use their links, and Help says how to apply. src/data/legalPages.json has the same.
-- Added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$credits already added stay."$lw$, $lw$credits already added stay.", "Affiliate program. Members can apply on the Affiliate program page with their website or channel and how they'll share LiteraryWorm. We review each application and may decline it. An approved affiliate gets a sign-up link with their own code.", "When someone who hasn't had a LiteraryWorm account signs up with that link and makes their first payment, we add 20% of that payment as a credit on the affiliate's own Stripe balance, taken off their next invoices. It's earned once per member, only while the affiliate has a paid membership, and has no cash value; there are no payouts. Staff can't be affiliates.", "Affiliates must say that they earn a commission wherever they share their link, as the FTC's Endorsement Guides require, and must never market LiteraryWorm to children or on pages, channels or apps made for them. We may suspend an affiliate who doesn't, or who sends visitors in misleading ways; a suspended link stops counting sign-ups and earning credit, and credits already added stay."$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$credits already added stay."$lw$) > 0
  and strpos(sections::text, $lw$Affiliate program$lw$) = 0
  and strpos(sections::text, $lw$Affiliates: the website$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$a friend sees only their own month."$lw$, $lw$a friend sees only their own month.", "Affiliates: the website or channel and description an affiliate applies with, when they agreed to the program's terms, our decision and who made it, and their code. Visits to an affiliate's link are counted per day, at most once per visitor a day; your IP address is used only to check that and isn't kept. When someone signs up with the link, we note which affiliate, and when they first pay, the commission credited (with Stripe's reference). Affiliates see only counts and their credit, never who signed up; our sales staff see applications with display names, never email addresses."$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$a friend sees only their own month."$lw$) > 0
  and strpos(sections::text, $lw$Affiliate program$lw$) = 0
  and strpos(sections::text, $lw$Affiliates: the website$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$A list you share by link is a wishlist too: its page has Give this list as a gift, which opens Gifts with up to 10 of its LiteraryWorm books already picked. Share a list in My Library → Lists to let family and friends know what you'd like."$lw$, $lw$A list you share by link is a wishlist too: its page has Give this list as a gift, which opens Gifts with up to 10 of its LiteraryWorm books already picked. Share a list in My Library → Lists to let family and friends know what you'd like.", "Affiliate program: members can apply on the Affiliate program page (in the footer). Once approved, you get a sign-up link; when someone joins with it and makes their first payment, 20% of that payment is added to your own membership as credit. You see visits, sign-ups and credit, never who signed up. Say that you earn a commission wherever you share it, and never aim it at children."$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$A list you share by link is a wishlist too: its page has Give this list as a gift, which opens Gifts with up to 10 of its LiteraryWorm books already picked. Share a list in My Library → Lists to let family and friends know what you'd like."$lw$) > 0
  and strpos(sections::text, $lw$Affiliate program$lw$) = 0
  and strpos(sections::text, $lw$Affiliates: the website$lw$) = 0;
