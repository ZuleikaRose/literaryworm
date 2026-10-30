-- Yearly to monthly at renewal (migration 4900): the Terms say monthly billing can be chosen at any
-- time and starts on the renewal date (src/data/legalPages.json has the same change). A page an
-- editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Yearly plans can't be paused, change their billing day, or move to monthly billing until the year ends.$lw$, $lw$Yearly plans can't be paused or change their billing day. You can choose monthly billing at any time, and it starts on your renewal date, with nothing charged or refunded before then.$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$Yearly plans can't be paused, change their billing day, or move to monthly billing until the year ends.$lw$) > 0;
