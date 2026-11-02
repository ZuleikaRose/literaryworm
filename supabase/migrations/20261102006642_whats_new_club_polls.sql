-- Club polls (club_polls and club_poll_votes, 6637-6640; Help and the Privacy Policy, 6641). This
-- adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'feature', $lw$Vote on your book club's next read$lw$, $lw$A club's owner can ask What to read next on the club's page: offer two to five LiteraryWorm books and members vote, seeing everyone's votes and changing theirs until the poll closes. The book with the most votes wins, and Start a club with it begins a club for it in one step. New polls show in the bell.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Vote on your book club's next read$lw$ and c.version = '2026.11');
