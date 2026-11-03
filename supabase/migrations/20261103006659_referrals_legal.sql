-- Refer a friend (6657): the Terms (30. Membership) say how invitation credits work, including the 2-month
-- limit, and the Privacy Policy what's kept. src/data/legalPages.json has the same. Added once; a page an editor
-- has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$they can then choose a plan like any member."$lw$, $lw$they can then choose a plan like any member.", "Inviting friends. Each member has a link to share from Account. When someone who hasn't had a LiteraryWorm account before signs up with it and makes their first payment, we add a month of their plan as a credit on their account, and a month of your own plan as a credit on yours. Credits come off your next invoices.", "You can earn up to 2 free months from inviting friends in all; the friends you invite after that still get their month. Credits have no cash value, can't be moved to another account, and aren't refunded when a membership ends. Staff memberships aren't billed, so they don't earn or receive credits.", "Invitations are for people you know. We may withhold or remove credits earned by signing up yourself again, by using made-up accounts, or by posting your link where it reaches people who didn't ask for it, and we may change or end the offer with notice in What's new; credits already added stay."$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$they can then choose a plan like any member."$lw$) > 0
  and strpos(sections::text, $lw$Inviting friends. Each member has a link$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$in a book club, members see each other's display names and pages, never which profile read."$lw$, $lw$in a book club, members see each other's display names and pages, never which profile read.", "Invitations: your invitation code, and for each friend who signed up with it, who invited them, when, and the month credited to each of you (with Stripe's reference for the credit). You see how many friends signed up and how many months you've earned, never who they are; a friend sees only their own month."$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$in a book club, members see each other's display names and pages, never which profile read."$lw$) > 0
  and strpos(sections::text, $lw$Invitations: your invitation code$lw$) = 0;
