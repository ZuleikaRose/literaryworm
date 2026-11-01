-- Reading statistics by book: the Privacy Policy, Children's Privacy Notice and Help say the time with each book is kept (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$time read and listened each day,$lw$, $lw$time read and listened each day, the time each profile spends with each book on each day and where in the book the day started and ended (for the book page's Your time with this book),$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$time read and listened each day,$lw$) > 0
  and strpos(sections::text, $lw$Your time with this book$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$release reminders, reading time and goals.$lw$, $lw$release reminders, reading time and goals. The time it spends with each book, day by day, is kept too, to show it on the book's page.$lw$)::jsonb, updated_at = now()
where slug = $lw$childrens-privacy$lw$
  and strpos(sections::text, $lw$release reminders, reading time and goals.$lw$) > 0
  and strpos(sections::text, $lw$time it spends with each book$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$From authors you follow and Loved it.$lw$, $lw$From authors you follow and Loved it. A book's page shows Your time with this book once you've read or listened to it: time spent, the days, your pace through it and your biggest days.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$From authors you follow and Loved it.$lw$) > 0
  and strpos(sections::text, $lw$Your time with this book$lw$) = 0;
