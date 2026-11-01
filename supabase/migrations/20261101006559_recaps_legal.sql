-- Chapter recaps: the Privacy Policy, Terms, Acceptable Use Policy and Help name Previously… (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Anthropic (Claude) writes book summaries, answers Ask the book questions, writes Who's who and writes chapter quizzes$lw$, $lw$Anthropic (Claude) writes book summaries, answers Ask the book questions, writes Who's who and writes chapter quizzes and Previously… recaps$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Anthropic (Claude) writes book summaries, answers Ask the book questions, writes Who's who and writes chapter quizzes$lw$) > 0
  and strpos(sections::text, $lw$Previously… recaps$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$We send only the book's text up to your chapter, nothing about you, and keep the list so the next reader at that chapter gets the same one.$lw$, $lw$We send only the book's text up to your chapter, nothing about you, and keep the list so the next reader at that chapter gets the same one. Previously…: in the player, a recap of a public-domain book up to the chapter you've reached. We send only the text of the chapters before it, nothing about you, and keep the recap so the next listener there gets the same one.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$We send only the book's text up to your chapter, nothing about you, and keep the list so the next reader at that chapter gets the same one.$lw$) > 0
  and strpos(sections::text, $lw$Previously…: in the player$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$including by trying to get around the limits on AI summaries, Ask the book, Who's who and chapter quizzes$lw$, $lw$including by trying to get around the limits on AI summaries, Ask the book, Who's who and chapter quizzes and Previously… recaps$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$including by trying to get around the limits on AI summaries, Ask the book, Who's who and chapter quizzes$lw$) > 0
  and strpos(sections::text, $lw$and Previously… recaps$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Summaries, Ask the book answers, Who's who and chapter quizzes are written by AI$lw$, $lw$Summaries, Ask the book answers, Who's who and chapter quizzes are written by AI (and so are Previously… recaps)$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$Summaries, Ask the book answers, Who's who and chapter quizzes are written by AI$lw$) > 0
  and strpos(sections::text, $lw$(and so are Previously… recaps)$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Our AI Products are the book summaries, Ask the book, Who's who and chapter quizzes$lw$, $lw$Our AI Products are the book summaries, Ask the book, Who's who and chapter quizzes and Previously… recaps$lw$)::jsonb, updated_at = now()
where slug = $lw$acceptable-use$lw$
  and strpos(sections::text, $lw$Our AI Products are the book summaries, Ask the book, Who's who and chapter quizzes$lw$) > 0
  and strpos(sections::text, $lw$quizzes and Previously… recaps$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and a quiz only the chapter it's about.$lw$, $lw$and a quiz only the chapter it's about. A Previously… recap gets only the chapters before yours.$lw$)::jsonb, updated_at = now()
where slug = $lw$acceptable-use$lw$
  and strpos(sections::text, $lw$and a quiz only the chapter it's about.$lw$) > 0
  and strpos(sections::text, $lw$A Previously… recap gets$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$your pace through it and your biggest days.$lw$, $lw$your pace through it and your biggest days. In the player (and the mini-player's More), Previously… catches you up on a public-domain book from the second chapter on: the story so far and the last chapter, written by AI from the chapters before yours only.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$your pace through it and your biggest days.$lw$) > 0
  and strpos(sections::text, $lw$Previously… catches you up$lw$) = 0;
