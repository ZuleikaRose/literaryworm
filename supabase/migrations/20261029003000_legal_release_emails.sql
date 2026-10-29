-- Book-out emails: the Privacy Policy says Mailgun also sends the email when a reminded
-- book is out (without open or click tracking), that the account keeps whether those
-- emails are wanted, and that they can be turned off apart from marketing
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old
-- versions; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Mailgun sends our account emails (confirming your email address and resetting your password), so it receives your email address and each email's contents.$lw$, $lw$Mailgun sends our emails (confirming your email address, resetting your password, and telling you when a book you set Remind me on is out), so it receives your email address and each email's contents. We turn off Mailgun's open and click tracking.$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%Mailgun sends our account emails (confirming your email address and resetting your password), so it receives your email address and each email's contents.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$whether you'd like marketing emails, when you accepted the Terms$lw$, $lw$whether you'd like marketing emails and emails when a reminded book is out, when you accepted the Terms$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%whether you'd like marketing emails, when you accepted the Terms%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$necessary for the administration and use of your account,$lw$, $lw$necessary for the administration and use of your account (emails about books you set Remind me on can be turned off separately in Account),$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%necessary for the administration and use of your account,%$lw$;
