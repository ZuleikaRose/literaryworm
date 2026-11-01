-- Offline listening on a schedule: the Cookie Policy and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$are kept on your device until you remove them from the book's page.$lw$, $lw$are kept on your device until you remove them from the book's page. If you turn on Listen offline on a schedule for an audiobook, the app also keeps a small note of that choice (how many chapters, Wi-Fi only, whether to remove finished ones) with the books, and saves or removes chapters as you listen; it goes when you turn it off or the books are cleared.$lw$)::jsonb, updated_at = now()
where slug = $lw$cookies$lw$
  and strpos(sections::text, $lw$are kept on your device until you remove them from the book's page.$lw$) > 0
  and strpos(sections::text, $lw$Listen offline on a schedule$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$J and K move it down or up a line.$lw$, $lw$J and K move it down or up a line. On an audiobook's page, Read offline has Listen offline on a schedule: this device keeps the chapter you're on and the next 1, 3, 5 or 10 as you listen, on Wi-Fi only if you like, and can remove chapters you've finished. It counts as one of your plan's offline devices.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$J and K move it down or up a line.$lw$) > 0
  and strpos(sections::text, $lw$keeps the chapter you're on and the next$lw$) = 0;
