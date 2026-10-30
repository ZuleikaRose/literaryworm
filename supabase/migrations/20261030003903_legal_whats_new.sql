-- What's new (migration 3900): the Privacy Policy lists the monthly What's new email among
-- what Mailgun sends, says the account keeps whether it's wanted (off until turned on), and
-- that it has a one-click unsubscribe link (src/data/legalPages.json has the same change).
-- The edit trigger keeps the old versions; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a weekly list of new books from authors you follow, and confirming that your account was deleted)$lw$, $lw$a weekly list of new books from authors you follow, a monthly round-up of what's new in LiteraryWorm if you turn it on, and confirming that your account was deleted)$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%a weekly list of new books from authors you follow, and confirming that your account was deleted)%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$emails when a reminded book is out and weekly emails about new books from authors you follow, when you accepted the Terms$lw$, $lw$emails when a reminded book is out, weekly emails about new books from authors you follow and the monthly What's new email (off until you turn it on), when you accepted the Terms$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%emails when a reminded book is out and weekly emails about new books from authors you follow, when you accepted the Terms%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$(emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account)$lw$, $lw$(emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account, and the monthly What's new email has a one-click unsubscribe link that works without signing in)$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%(emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account)%$lw$;
