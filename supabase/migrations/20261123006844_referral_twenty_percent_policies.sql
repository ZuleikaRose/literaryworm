-- Refer a friend, 20% of one month (6843): the Terms (30. Membership) say what each side is credited, that
-- the inviter's credit is once per account, and how free months earned before the change are kept; the
-- Privacy Policy says which offer is noted for each invitation. Same text as src/data/legalPages.json,
-- matched as stored (jsonb text puts a space after each comma); made once, and a page an editor has
-- reworded is left as it is. The edit trigger keeps each old version.

update public.legal_pages
set sections = replace(sections::text, $lw$"Inviting friends. Each member has a link to share from Account. When someone who hasn't had a LiteraryWorm account before signs up with it and makes their first payment, we add a month of their plan as a credit on their account, and a month of your own plan as a credit on yours. Credits come off your next invoices."$lw$, $lw$"Inviting friends. Each member has a link to share from Account. When someone who hasn't had a LiteraryWorm account before signs up with it and makes their first payment, we add 20% of one month of their plan as a credit on their account, and 20% of one month of your own plan as a credit on yours. On yearly billing, a month is a twelfth of the yearly price. Credits are rounded to the cent and come off your next invoices."$lw$)::jsonb
where slug = 'terms'
  and strpos(sections::text, $lw$"Inviting friends. Each member has a link to share from Account. When someone who hasn't had a LiteraryWorm account before signs up with it and makes their first payment, we add a month of their plan as a credit on their account, and a month of your own plan as a credit on yours. Credits come off your next invoices."$lw$) > 0
  and strpos(sections::text, $lw$we add 20% of one month of their plan$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$"You can earn up to 2 free months from inviting friends in all; the friends you invite after that still get their month. Credits have no cash value, can't be moved to another account, and aren't refunded when a membership ends. Staff memberships aren't billed, so they don't earn or receive credits."$lw$, $lw$"You earn the credit for inviting once per account, however many friends join with your link, and every friend you invite still gets theirs. Credits have no cash value, can't be moved to another account, and aren't refunded when a membership ends. Staff memberships aren't billed, so they don't earn or receive credits.", "Until November 2026 the reward was a free month for each of you, up to 2 free months for inviting. Free months already added to an account stay, and so do those earned when a friend joined and made their first payment before the change. A friend who hadn't made their first payment by then gets the 20% credit instead, and so does the member who invited them."$lw$)::jsonb
where slug = 'terms'
  and strpos(sections::text, $lw$"You can earn up to 2 free months from inviting friends in all; the friends you invite after that still get their month. Credits have no cash value, can't be moved to another account, and aren't refunded when a membership ends. Staff memberships aren't billed, so they don't earn or receive credits."$lw$) > 0
  and strpos(sections::text, $lw$You earn the credit for inviting once per account$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$"Invitations: your invitation code, and for each friend who signed up with it, who invited them, when, and the month credited to each of you (with Stripe's reference for the credit). You see how many friends signed up and how many months you've earned, never who they are; a friend sees only their own month."$lw$, $lw$"Invitations: your invitation code, and for each friend who signed up with it, who invited them, when, which offer applied (20% of a month, or a free month before November 2026), and the credit added to each of you (with Stripe's reference for the credit). You see how many friends signed up and whether your credit has been added, never who they are; a friend sees only their own credit."$lw$)::jsonb
where slug = 'privacy'
  and strpos(sections::text, $lw$"Invitations: your invitation code, and for each friend who signed up with it, who invited them, when, and the month credited to each of you (with Stripe's reference for the credit). You see how many friends signed up and how many months you've earned, never who they are; a friend sees only their own month."$lw$) > 0
  and strpos(sections::text, $lw$which offer applied (20% of a month$lw$) = 0;
