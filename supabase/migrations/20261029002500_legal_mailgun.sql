-- Auth emails (confirming an address, resetting a password) are now sent by
-- Mailgun, through Supabase Auth's SMTP setting: the Privacy Policy names it as a
-- service provider and the EULA lists it with the other services the app relies on
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old
-- versions; a page an editor has reworded since is left as it is.
update public.legal_pages
set sections = replace(sections::text, $lw$Vercel hosts the website. Neither may use your data for their own purposes.$lw$, $lw$Vercel hosts the website. Mailgun sends our account emails (confirming your email address and resetting your password), so it receives your email address and each email's contents. None of them may use your data for their own purposes.$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%Vercel hosts the website. Neither may use your data for their own purposes.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Supabase, Vercel, Anthropic, Google Books$lw$, $lw$Supabase, Vercel, Mailgun, Anthropic, Google Books$lw$)::jsonb
where slug = 'eula'
  and sections::text like $lw$%Supabase, Vercel, Anthropic, Google Books%$lw$;
