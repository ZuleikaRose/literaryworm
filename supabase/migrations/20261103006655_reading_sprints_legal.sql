-- Reading sprints (6649): the Privacy Policy and the Children's Privacy Notice say what a sprint keeps, who sees
-- it and for how long. src/data/legalPages.json has the same. Added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$where in the book the day started and ended (for the book page's Your time with this book)."$lw$, $lw$where in the book the day started and ended (for the book page's Your time with this book).", "Reading sprints: when a sprint started and how long it ran, which of your profiles joined, and the pages each turned in the reader during it, kept for 90 days. A household sees its profiles' names; in a book club, members see each other's display names and pages, never which profile read."$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$where in the book the day started and ended (for the book page's Your time with this book)."$lw$) > 0
  and strpos(sections::text, $lw$Reading sprints: when a sprint started$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and the household challenges it starts or joins, which the other profiles on your account can see.$lw$, $lw$the household challenges it starts or joins, and the reading sprints it joins at home with the pages it turned (kept 90 days), which the other profiles on your account can see. Kids profiles can't join a book club's sprints.$lw$)::jsonb, updated_at = now()
where slug = $lw$childrens-privacy$lw$
  and strpos(sections::text, $lw$and the household challenges it starts or joins, which the other profiles on your account can see.$lw$) > 0;
