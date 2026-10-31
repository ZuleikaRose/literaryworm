-- Reading tools (src/data/legalPages.json has the same change): the policies name what the new
-- features keep (saved words, Up next, reading pace, quiz scores, reader follows and the reader
-- page), that Claude writes chapter quizzes from the chapter's text only, that exports are made in
-- the browser, and that casting loads nothing and keeps nothing in the browser. A page an editor
-- has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$your bookmarks, highlights, lists, goals and stats.$lw$, $lw$your bookmarks, highlights, saved words, lists, Up next queue, goals and stats.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$your bookmarks, highlights, lists, goals and stats.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Anthropic (Claude) writes book summaries, answers Ask the book questions and writes Who's who (see section 6).$lw$, $lw$Anthropic (Claude) writes book summaries, answers Ask the book questions, writes Who's who and writes chapter quizzes (see section 6).$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Anthropic (Claude) writes book summaries, answers Ask the book questions and writes Who's who (see section 6).$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Ask the book and Who's who aren't offered to Kids profiles. Summaries, answers and Who's who are labelled as written by AI.$lw$, $lw$Chapter quizzes: a few questions about a chapter of a public-domain book, written for young readers. We send only that chapter's text, nothing about you, and keep the quiz so every reader of that chapter gets the same one; your score is saved with your profile. Ask the book and Who's who aren't offered to Kids profiles; quizzes are. Summaries, answers, Who's who and quizzes are labelled as written by AI.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Ask the book and Who's who aren't offered to Kids profiles. Summaries, answers and Who's who are labelled as written by AI.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$highlights and notes, ratings, favourites and lists, the authors and narrators you follow$lw$, $lw$highlights and notes, the words you save from the dictionary (with the sentence you met them in), ratings, favourites and lists, your Up next queue, the authors and narrators you follow$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$highlights and notes, ratings, favourites and lists, the authors and narrators you follow$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$time read and listened each day, and the books you finish.$lw$, $lw$time read and listened each day, your reading pace (words a minute, used to show the time left in a chapter), chapter quiz scores, and the books you finish. If you turn on your reader page (it's off until you do), the reading logs you've already made public are listed together on one public page under your display name, and other members can follow it; who follows whom is never shown, and turning the page off removes its followers. Exports of your highlights and notes are made in your browser and downloaded to your device; they're never uploaded.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$time read and listened each day, and the books you finish.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Your library, reading progress, bookmarks, highlights, lists, ratings, reading time, player settings, club activity and uploaded books are saved with your account on our servers (Supabase), not in browser cookies.$lw$, $lw$Your library, reading progress, bookmarks, highlights, saved words, lists, Up next queue, ratings, reading time and pace, quiz scores, player settings, club activity and uploaded books are saved with your account on our servers (Supabase), not in browser cookies. Listening on a speaker or TV uses your browser's own Chromecast or AirPlay picker: it loads no script, sets no cookie and keeps nothing in your browser, and the speaker plays the recording straight from the Internet Archive.$lw$)::jsonb, updated_at = now()
where slug = $lw$cookies$lw$
  and strpos(sections::text, $lw$Your library, reading progress, bookmarks, highlights, lists, ratings, reading time, player settings, club activity and uploaded books are saved with your account on our servers (Supabase), not in browser cookies.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$bookmarks, highlights and notes, ratings, favourites and lists,$lw$, $lw$bookmarks, highlights and notes, the words it saves from the dictionary, its chapter quiz scores (which you can see in Account), its Up next queue and reading pace, ratings, favourites and lists,$lw$)::jsonb, updated_at = now()
where slug = $lw$childrens-privacy$lw$
  and strpos(sections::text, $lw$bookmarks, highlights and notes, ratings, favourites and lists,$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Reading logs, club posts, highlights and uploads can each be deleted whenever you like.$lw$, $lw$Reading logs, club posts, highlights, saved words and uploads can each be deleted whenever you like, and your reader page can be turned off.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy-choices$lw$
  and strpos(sections::text, $lw$Reading logs, club posts, highlights and uploads can each be deleted whenever you like.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$including by trying to get around the limits on AI summaries, Ask the book and Who's who.$lw$, $lw$including by trying to get around the limits on AI summaries, Ask the book, Who's who and chapter quizzes.$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$including by trying to get around the limits on AI summaries, Ask the book and Who's who.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Summaries, Ask the book answers and Who's who are written by AI (Claude) and labelled so.$lw$, $lw$Summaries, Ask the book answers, Who's who and chapter quizzes are written by AI (Claude) and labelled so.$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$Summaries, Ask the book answers and Who's who are written by AI (Claude) and labelled so.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Notes, highlights and private lists are never shown to anyone else.$lw$, $lw$Notes, highlights, saved words and private lists are never shown to anyone else.$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$Notes, highlights and private lists are never shown to anyone else.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Notes, highlights and private lists are never shown to anyone else.$lw$, $lw$Notes, highlights, saved words and private lists are never shown to anyone else.$lw$)::jsonb, updated_at = now()
where slug = $lw$eula$lw$
  and strpos(sections::text, $lw$Notes, highlights and private lists are never shown to anyone else.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Our AI Products are the book summaries, Ask the book and Who's who, which are written by Claude$lw$, $lw$Our AI Products are the book summaries, Ask the book, Who's who and chapter quizzes, which are written by Claude$lw$)::jsonb, updated_at = now()
where slug = $lw$acceptable-use$lw$
  and strpos(sections::text, $lw$Our AI Products are the book summaries, Ask the book and Who's who, which are written by Claude$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$why Ask the book and Who's who are only given the text up to your place in the book.$lw$, $lw$why Ask the book and Who's who are only given the text up to your place in the book, and a quiz only the chapter it's about.$lw$)::jsonb, updated_at = now()
where slug = $lw$acceptable-use$lw$
  and strpos(sections::text, $lw$why Ask the book and Who's who are only given the text up to your place in the book.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and summaries and answers written by AI, which are labelled as such.$lw$, $lw$and summaries, answers and quizzes written by AI, which are labelled as such.$lw$)::jsonb, updated_at = now()
where slug = $lw$disclaimer$lw$
  and strpos(sections::text, $lw$and summaries and answers written by AI, which are labelled as such.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Summaries, Ask the book and Who's who (AI): working normally.$lw$, $lw$Summaries, Ask the book, Who's who and chapter quizzes (AI): working normally.$lw$)::jsonb, updated_at = now()
where slug = $lw$status$lw$
  and strpos(sections::text, $lw$Summaries, Ask the book and Who's who (AI): working normally.$lw$) > 0;
