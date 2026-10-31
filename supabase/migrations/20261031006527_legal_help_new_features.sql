-- Help: the reading journal, word review, rest days and Kids book requests (src/data/legalPages.json
-- has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$To read or listen without a connection, choose Read offline on a public-domain book's page.$lw$, $lw$To read or listen without a connection, choose Read offline on a public-domain book's page. Each book's page has My journal for private, dated notes only you see; they're exported with your highlights from My Library → Notes. Words you keep from the dictionary come back for review in My words, after 1, 3, 7, 14, 30 and 60 days while you know them. Your reading streak has two rest days a month, used automatically when you miss a day.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$To read or listen without a connection, choose Read offline on a public-domain book's page.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$You can cancel or pause online at any time.$lw$, $lw$You can cancel or pause online at any time. A Kids profile can ask for a book that isn't on its shelf; a grown-up says yes or no in Account → Family with the account password, and a yes opens that one book for that profile.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$You can cancel or pause online at any time.$lw$) > 0;
