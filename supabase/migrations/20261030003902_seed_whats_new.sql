-- The first What's new entries: what shipped in October 2026 (src/data/changelog.json has
-- the same, shown until the page loads and in a copy without the backend). Data only;
-- skipped for any title already there, so editors' entries are never duplicated.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select v.released_on, v.version, v.kind, v.title, v.body, v.major
from (values
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$What's new$lw$, $lw$This page: every new feature, fix and update, newest first. Turn on the monthly round-up of the biggest changes in Account → Preferences.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Who's who$lw$, $lw$In the reader of a public-domain classic, the people icon lists the characters you've met so far, with what the book has shown about them. Nobody you haven't met yet is listed, and nothing later is given away.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Import from Goodreads or StoryGraph$lw$, $lw$Bring your reading history: export it from either site and choose Import in My Library. We find each book, show you the matches, and add them with your shelves and star ratings. Books you'd already read don't count towards this year's goal.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Household reading challenges$lw$, $lw$Take on a goal together, like 5 books in November or 20 hours this month. Everyone in the household can join and see each other's progress in My Library → Goals.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Share your year$lw$, $lw$Year in Review can now be shared as a picture: your books, hours, longest streak, covers and favourite genre, in a dark or light card.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$New books from authors you follow$lw$, $lw$When an author you follow has a new book out, it shows in the bell, and a weekly email lists them. Turn the email off in Account → Preferences.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$The notification bell$lw$, $lw$The bell at the top counts what's new for your profile: books you set Remind me on that are out, new posts in your book clubs and new books from authors you follow. What you've seen is seen on every device.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Cancel at least 48 hours before your billing date$lw$, $lw$To stop the next charge, cancel at least 48 hours before your billing date. Cancelling later still ends your membership, after one more month. Account shows which applies before you confirm. No refunds.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$The price after a promo code$lw$, $lw$Account now shows what your plan will cost once a promo code stops applying.$lw$, false),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Clearer plans and more answers$lw$, $lw$Each plan lists everything it includes, and Common questions now covers billing, pausing, gifts, audiobooks, importing, privacy and the AI features.$lw$, false),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$A confirmation when you delete your account$lw$, $lw$After an account is deleted, we email the address to confirm what was removed and that nothing more will be charged.$lw$, false),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$No sideways scrolling on narrow phones$lw$, $lw$The header on the home page no longer pushes Sign up off the screen while the app's font is loading.$lw$, false),
  ($lw$2026-10-29$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Invite friends to your book club by email$lw$, $lw$Send an invitation from the club's page; the email links straight to joining.$lw$, false),
  ($lw$2026-10-29$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$An email when a book you're waiting for comes out$lw$, $lw$Set Remind me on a book that isn't out yet, and we'll email you on the day as well as showing it on Home.$lw$, false),
  ($lw$2026-10-29$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Gift memberships$lw$, $lw$Give one, three, six or twelve months of any plan, paid once. The code never expires.$lw$, false)
) as v(released_on, version, kind, title, body, major)
where not exists (select 1 from public.changelog_entries c where c.title = v.title and c.version = v.version);
