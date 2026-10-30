-- New books from followed authors and the deletion email: the Privacy Policy says Mailgun
-- also sends the weekly email of new books from followed authors and the email confirming an
-- account was deleted, that the account keeps whether the weekly email is wanted (and it can
-- be turned off), that the new books found are kept for 60 days, and that our server sends
-- Google Books the names of followed authors, never who follows them
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old versions; a
-- page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$telling you when a book you set Remind me on is out) and the book club invitations members send$lw$, $lw$telling you when a book you set Remind me on is out, a weekly list of new books from authors you follow, and confirming that your account was deleted) and the book club invitations members send$lw$)::jsonb
where sections::text like $lw$%telling you when a book you set Remind me on is out) and the book club invitations members send%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$whether you'd like marketing emails and emails when a reminded book is out, when you accepted the Terms$lw$, $lw$whether you'd like marketing emails, emails when a reminded book is out and weekly emails about new books from authors you follow, when you accepted the Terms$lw$)::jsonb
where sections::text like $lw$%whether you'd like marketing emails and emails when a reminded book is out, when you accepted the Terms%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$the authors and narrators you follow, release reminders,$lw$, $lw$the authors and narrators you follow (and, for 60 days, the new books we find by the authors you follow), release reminders,$lw$)::jsonb
where sections::text like $lw$%the authors and narrators you follow, release reminders,%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$(emails about books you set Remind me on can be turned off separately in Account)$lw$, $lw$(emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account)$lw$)::jsonb
where sections::text like $lw$%(emails about books you set Remind me on can be turned off separately in Account)%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$sends it search words and book ids, never who's asking.$lw$, $lw$sends it search words, book ids and the names of authors people follow, never who's asking.$lw$)::jsonb
where sections::text like $lw$%sends it search words and book ids, never who's asking.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$which sends only the search words and book ids, never who's asking.$lw$, $lw$which sends only the search words, book ids and the names of authors people follow, never who's asking.$lw$)::jsonb
where sections::text like $lw$%which sends only the search words and book ids, never who's asking.%$lw$;
