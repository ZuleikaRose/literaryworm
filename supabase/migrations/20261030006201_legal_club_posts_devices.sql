-- This round's policy wording (src/data/legalPages.json has the same change): the Privacy Policy
-- lists the daily book club posts email among what Mailgun receives and says devices are one per
-- browser; the Cookie Policy describes literaryworm-device in local storage. A page an editor has
-- reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$with the meeting as a calendar file), a reminder three days before$lw$, $lw$with the meeting as a calendar file), a daily email of new posts in your book clubs if you turn it on (each club's name and book, the chapters you've reached that have new posts, how many and the display names of who wrote them; never what they wrote), a reminder three days before$lw$)::json
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$with the meeting as a calendar file), a reminder three days before$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Devices: while you're signed in, a short label for each open copy of the app (such as \"Chrome on Windows\") so you can send a book to another device.$lw$, $lw$Devices: while you're signed in, a short label for each browser you use the app in (such as \"Chrome on Windows\") so you can send a book to another device.$lw$)::json
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$Devices: while you're signed in, a short label for each open copy of the app (such as \"Chrome on Windows\") so you can send a book to another device.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out.$lw$, $lw$so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out. Next to it the app keeps which of your devices this browser is (under literaryworm-device: a random id and your account's id, nothing else), so a refresh or a second tab isn't listed as a new device in Listen on another device; it's removed when you log out too.$lw$)::json
where slug in ($lw$cookies$lw$)
  and strpos(sections::text, $lw$so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out.$lw$) > 0;
