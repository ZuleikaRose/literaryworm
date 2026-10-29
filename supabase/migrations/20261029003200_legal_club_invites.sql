-- Club invites by email: the Privacy Policy says Mailgun also sends the invitations
-- members send, what the invitation shows, and that only a fingerprint of the address
-- is kept for 30 days (src/data/legalPages.json has the same change). The edit trigger
-- keeps the old versions; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$telling you when a book you set Remind me on is out), so it receives your email address and each email's contents.$lw$, $lw$telling you when a book you set Remind me on is out) and the book club invitations members send, so it receives the address each email goes to and the email's contents.$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%telling you when a book you set Remind me on is out), so it receives your email address and each email's contents.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Book club posts are seen by the club's members. Lists you share$lw$, $lw$Book club posts are seen by the club's members. If you invite someone to a club by email, the invitation shows them your display name and the club's name, book and finish date; we send it through Mailgun and keep only a one-way fingerprint of their address for 30 days (so the same address isn't invited again within a week), never the address itself. Lists you share$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%Book club posts are seen by the club's members. Lists you share%$lw$;
