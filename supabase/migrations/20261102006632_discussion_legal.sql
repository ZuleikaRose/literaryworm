-- Book clubs' discussion questions: the Privacy Policy, Terms, Acceptable Use Policy, Disclaimer and Help name them
-- (src/data/legalPages.json has the same). Each change is made once; a page an editor has reworded is left as it is.
-- Also tidies the Terms' list, which named Previously… recaps twice.

update public.legal_pages
set sections = replace(sections::text, $lw$writes Who's who and writes chapter quizzes and Previously… recaps (see section 6).$lw$, $lw$writes Who's who, chapter quizzes, Previously… recaps and book clubs' discussion questions (see section 6).$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$writes Who's who and writes chapter quizzes and Previously… recaps (see section 6).$lw$) > 0
  and strpos(sections::text, $lw$book clubs' discussion questions (see section 6)$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and keep the recap so the next listener there gets the same one."$lw$, $lw$and keep the recap so the next listener there gets the same one.", "Discussion questions: on a book club's page, questions about a chapter of a public-domain book you've reached. We send only the book's text up to the end of that chapter, nothing about you or the club, and keep the questions so every club at that chapter gets the same ones."$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$and keep the recap so the next listener there gets the same one."$lw$) > 0
  and strpos(sections::text, $lw$Discussion questions: on a book club's page$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Ask the book, Translate and Who's who aren't offered to Kids profiles;$lw$, $lw$Ask the book, Translate, Who's who and book clubs (with their discussion questions) aren't offered to Kids profiles;$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Ask the book, Translate and Who's who aren't offered to Kids profiles;$lw$) > 0
  and strpos(sections::text, $lw$and book clubs (with their discussion questions) aren't$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Who's who, recaps and quizzes are labelled as written by AI.$lw$, $lw$Who's who, recaps, quizzes and discussion questions are labelled as written by AI.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Who's who, recaps and quizzes are labelled as written by AI.$lw$) > 0
  and strpos(sections::text, $lw$quizzes and discussion questions are labelled$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Who's who, Previously… recaps and chapter quizzes and Previously… recaps.$lw$, $lw$Who's who, Previously… recaps, chapter quizzes and discussion questions.$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$Who's who, Previously… recaps and chapter quizzes and Previously… recaps.$lw$) > 0
  and strpos(sections::text, $lw$chapter quizzes and discussion questions.$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Who's who, Previously… recaps and chapter quizzes are written by AI (Claude) and labelled so.$lw$, $lw$Who's who, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude) and labelled so.$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$Who's who, Previously… recaps and chapter quizzes are written by AI (Claude) and labelled so.$lw$) > 0
  and strpos(sections::text, $lw$chapter quizzes and discussion questions are written by AI (Claude) and labelled so$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Who's who, chapter quizzes and Previously… recaps. They're written by Claude$lw$, $lw$Who's who, chapter quizzes, Previously… recaps and book clubs' discussion questions. They're written by Claude$lw$)::jsonb, updated_at = now()
where slug = $lw$acceptable-use$lw$
  and strpos(sections::text, $lw$Who's who, chapter quizzes and Previously… recaps. They're written by Claude$lw$) > 0
  and strpos(sections::text, $lw$recaps and book clubs' discussion questions. They're$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$A Previously… recap gets only the chapters before yours.$lw$, $lw$A Previously… recap gets only the chapters before yours, and discussion questions only the book up to the end of their chapter.$lw$)::jsonb, updated_at = now()
where slug = $lw$acceptable-use$lw$
  and strpos(sections::text, $lw$A Previously… recap gets only the chapters before yours.$lw$) > 0
  and strpos(sections::text, $lw$and discussion questions only the book up to$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Who's who, Previously… recaps and chapter quizzes are written by AI (Claude, made by Anthropic)$lw$, $lw$Who's who, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude, made by Anthropic)$lw$)::jsonb, updated_at = now()
where slug = $lw$disclaimer$lw$
  and strpos(sections::text, $lw$Who's who, Previously… recaps and chapter quizzes are written by AI (Claude, made by Anthropic)$lw$) > 0
  and strpos(sections::text, $lw$chapter quizzes and discussion questions are written by AI (Claude, made by Anthropic)$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and stop sharing it whenever you like."$lw$, $lw$and stop sharing it whenever you like.", "On a public-domain book, Discussion questions under a club's discussion gives five to eight questions about a chapter you've reached, written by AI from the book up to the end of that chapter only. Choose Start a post with this to begin a post with one."$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$and stop sharing it whenever you like."$lw$) > 0
  and strpos(sections::text, $lw$Discussion questions under a club's discussion$lw$) = 0;
