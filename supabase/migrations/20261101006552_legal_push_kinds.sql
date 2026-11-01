-- More kinds of notification (migration 6550): the Privacy Policy and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$encrypted so that only your browser can read it.$lw$, $lw$encrypted so that only your browser can read it. You choose in Account → Preferences which kinds your devices get; besides release days they can be a club meeting in the next day (the club's and meeting's names), new posts in your clubs (the club's name, how many, the chapter and who wrote them; never what they said), an evening reading-streak nudge (a profile's name and run of days; for this we keep each device's time zone) and a grown-up's answer to a Kids book request (the profile's name and the book).$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$encrypted so that only your browser can read it.$lw$) > 0
  and strpos(sections::text, $lw$evening reading-streak nudge$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$turn on Notifications on this device in Account → Preferences.$lw$, $lw$turn on Notifications on this device in Account → Preferences. Once it's on, choose there which notifications you get: books you're waiting for, club meetings, new club posts up to your chapter, an evening streak nudge, and answers to Kids book requests.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$turn on Notifications on this device in Account → Preferences.$lw$) > 0
  and strpos(sections::text, $lw$an evening streak nudge$lw$) = 0;
