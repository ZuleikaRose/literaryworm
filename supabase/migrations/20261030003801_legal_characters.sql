-- Who's who (migration 3800): the Privacy Policy, Terms, Acceptable Use Policy and status page
-- name it among the AI features, say what Anthropic receives for it (the book's text up to
-- the reader's chapter, nothing about them) and that it isn't offered to Kids profiles
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old versions; a
-- page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Anthropic (Claude) writes book summaries and answers Ask the book questions (see section 6).$lw$, $lw$Anthropic (Claude) writes book summaries, answers Ask the book questions and writes Who's who (see section 6).$lw$)::jsonb
where sections::text like $lw$%Anthropic (Claude) writes book summaries and answers Ask the book questions (see section 6).%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Ask the book isn't offered to Kids profiles. Summaries and answers are labelled as written by AI.$lw$, $lw$Who's who: the characters you've met in a public-domain book so far. We send only the book's text up to your chapter, nothing about you, and keep the list so the next reader at that chapter gets the same one. Ask the book and Who's who aren't offered to Kids profiles. Summaries, answers and Who's who are labelled as written by AI.$lw$)::jsonb
where sections::text like $lw$%Ask the book isn't offered to Kids profiles. Summaries and answers are labelled as written by AI.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$including by trying to get around the limits on AI summaries and Ask the book.$lw$, $lw$including by trying to get around the limits on AI summaries, Ask the book and Who's who.$lw$)::jsonb
where sections::text like $lw$%including by trying to get around the limits on AI summaries and Ask the book.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Summaries and Ask the book answers are written by AI (Claude) and labelled so.$lw$, $lw$Summaries, Ask the book answers and Who's who are written by AI (Claude) and labelled so.$lw$)::jsonb
where sections::text like $lw$%Summaries and Ask the book answers are written by AI (Claude) and labelled so.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Our AI Products are the book summaries and Ask the book, which are written by Claude,$lw$, $lw$Our AI Products are the book summaries, Ask the book and Who's who, which are written by Claude,$lw$)::jsonb
where sections::text like $lw$%Our AI Products are the book summaries and Ask the book, which are written by Claude,%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$and why Ask the book is only given the text up to your place in the book.$lw$, $lw$and why Ask the book and Who's who are only given the text up to your place in the book.$lw$)::jsonb
where sections::text like $lw$%and why Ask the book is only given the text up to your place in the book.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Summaries and Ask the book (AI): working normally.$lw$, $lw$Summaries, Ask the book and Who's who (AI): working normally.$lw$)::jsonb
where sections::text like $lw$%Summaries and Ask the book (AI): working normally.%$lw$;
