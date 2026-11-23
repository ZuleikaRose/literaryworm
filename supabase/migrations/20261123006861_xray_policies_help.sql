-- X-Ray (Who's who, places and terms), dictionary lookups and note exports: Help, the Privacy Policy, the Children's
-- Privacy Notice, Terms, Acceptable Use, Disclaimer and Status. Same text as src/data/legalPages.json.
--
-- One update per page (so one revision row each), and loud: a passage that's neither in its old wording nor already
-- in its new one stops the migration with the page and the passage named, instead of skipping it. Run again, it
-- changes nothing. What's sent to Claude is unchanged (the public-domain text up to the reader's chapter, nothing
-- about the reader); uploads and Kids profiles get names found on the device, with nothing sent.

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'xray policies: the help page is missing'; end if;
  was := s;
  -- passage 1
  if strpos(s, $lw$To look up a word, select it in the reader and choose Define, or open Dictionary (press D) in the reader or the player and type it. Words are looked up in the book's own language, with definitions in English from Wiktionary, and you can switch to English. Keep a word in My words to review later. Export a book's highlights, notes and journal from the reader's Notes and highlights, or every book's from My Library → Notes.$lw$) = 0 then
    if strpos(s, $lw$"In the player (and the mini-player's More), Previously… catches you up on a public-domain book from the second chapter on: the story so far and the last chapter, written by AI from the chapters before yours only."$lw$) = 0 then
      raise exception 'xray policies: on the help page, this passage was not found as stored: %', $lw$In the player (and the mini-player's More), Previously… catches you up on a public-domain book from the second chapter o$lw$;
    end if;
    s := replace(s, $lw$"In the player (and the mini-player's More), Previously… catches you up on a public-domain book from the second chapter on: the story so far and the last chapter, written by AI from the chapters before yours only."$lw$, $lw$"In the player (and the mini-player's More), Previously… catches you up on a public-domain book from the second chapter on: the story so far and the last chapter, written by AI from the chapters before yours only.", "X-Ray, in the reader's top bar (or press X) and in the player, lists the people (Who's who), places and terms you've met so far, with how often and where the book names them, in this chapter or in the book so far. Choose a chapter or page to go to a mention.", "For the public-domain classics, X-Ray's descriptions are written by AI from the text up to your chapter only. In books you upload, and on Kids profiles, it lists the names it finds in the text on your device instead: no AI, and nothing is sent. Books with only sample pages have no X-Ray.", "To look up a word, select it in the reader and choose Define, or open Dictionary (press D) in the reader or the player and type it. Words are looked up in the book's own language, with definitions in English from Wiktionary, and you can switch to English. Keep a word in My words to review later. Export a book's highlights, notes and journal from the reader's Notes and highlights, or every book's from My Library → Notes."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'help'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'privacy' for update;
  if s is null then raise exception 'xray policies: the privacy page is missing'; end if;
  was := s;
  -- passage 2
  if strpos(s, $lw$Anthropic (Claude) writes book summaries and content notes, answers Ask the book questions, translates passages you select, writes X-Ray (Who's who, places and terms), chapter quizzes, Previously… recaps and book clubs' discussion questions (see section 6).$lw$) = 0 then
    if strpos(s, $lw$"Anthropic (Claude) writes book summaries and content notes, answers Ask the book questions, translates passages you select, writes Who's who, chapter quizzes, Previously… recaps and book clubs' discussion questions (see section 6)."$lw$) = 0 then
      raise exception 'xray policies: on the privacy page, this passage was not found as stored: %', $lw$Anthropic (Claude) writes book summaries and content notes, answers Ask the book questions, translates passages you sele$lw$;
    end if;
    s := replace(s, $lw$"Anthropic (Claude) writes book summaries and content notes, answers Ask the book questions, translates passages you select, writes Who's who, chapter quizzes, Previously… recaps and book clubs' discussion questions (see section 6)."$lw$, $lw$"Anthropic (Claude) writes book summaries and content notes, answers Ask the book questions, translates passages you select, writes X-Ray (Who's who, places and terms), chapter quizzes, Previously… recaps and book clubs' discussion questions (see section 6)."$lw$);
  end if;
  -- passage 3
  if strpos(s, $lw$X-Ray (Who's who, places and terms): the people, places and terms you've met in a public-domain book so far. We send only the book's text up to your chapter, nothing about you, and keep the names and descriptions so the next reader at that chapter gets the same ones. How often each is mentioned is counted on your device.$lw$) = 0 then
    if strpos(s, $lw$"Who's who: the characters you've met in a public-domain book so far. We send only the book's text up to your chapter, nothing about you, and keep the list so the next reader at that chapter gets the same one."$lw$) = 0 then
      raise exception 'xray policies: on the privacy page, this passage was not found as stored: %', $lw$Who's who: the characters you've met in a public-domain book so far. We send only the book's text up to your chapter, no$lw$;
    end if;
    s := replace(s, $lw$"Who's who: the characters you've met in a public-domain book so far. We send only the book's text up to your chapter, nothing about you, and keep the list so the next reader at that chapter gets the same one."$lw$, $lw$"X-Ray (Who's who, places and terms): the people, places and terms you've met in a public-domain book so far. We send only the book's text up to your chapter, nothing about you, and keep the names and descriptions so the next reader at that chapter gets the same ones. How often each is mentioned is counted on your device.", "For books you upload, and on Kids profiles, X-Ray lists the names it finds in the text on your device and sends nothing anywhere."$lw$);
  end if;
  -- passage 4
  if strpos(s, $lw$Ask the book, Translate, X-Ray's AI descriptions and book clubs (with their discussion questions) aren't offered to Kids profiles, and natural voices only when a grown-up turns them on for that profile; summaries, content notes, recaps and quizzes are. Summaries, content notes, answers, translations, X-Ray descriptions, recaps, quizzes and discussion questions are labelled as written by AI, and natural voices are named as Google's in the player.$lw$) = 0 then
    if strpos(s, $lw$"Ask the book, Translate, Who's who and book clubs (with their discussion questions) aren't offered to Kids profiles, and natural voices only when a grown-up turns them on for that profile; summaries, content notes, recaps and quizzes are. Summaries, content notes, answers, translations, Who's who, recaps, quizzes and discussion questions are labelled as written by AI, and natural voices are named as Google's in the player."$lw$) = 0 then
      raise exception 'xray policies: on the privacy page, this passage was not found as stored: %', $lw$Ask the book, Translate, Who's who and book clubs (with their discussion questions) aren't offered to Kids profiles, and$lw$;
    end if;
    s := replace(s, $lw$"Ask the book, Translate, Who's who and book clubs (with their discussion questions) aren't offered to Kids profiles, and natural voices only when a grown-up turns them on for that profile; summaries, content notes, recaps and quizzes are. Summaries, content notes, answers, translations, Who's who, recaps, quizzes and discussion questions are labelled as written by AI, and natural voices are named as Google's in the player."$lw$, $lw$"Ask the book, Translate, X-Ray's AI descriptions and book clubs (with their discussion questions) aren't offered to Kids profiles, and natural voices only when a grown-up turns them on for that profile; summaries, content notes, recaps and quizzes are. Summaries, content notes, answers, translations, X-Ray descriptions, recaps, quizzes and discussion questions are labelled as written by AI, and natural voices are named as Google's in the player."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'privacy'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'childrens-privacy' for update;
  if s is null then raise exception 'xray policies: the childrens-privacy page is missing'; end if;
  was := s;
  -- passage 5
  if strpos(s, $lw$They can't write public reading logs, join or start book clubs, follow other readers, share lists by link, upload or import books, search Google Books, ask the book's AI assistant, translate passages or see X-Ray's AI descriptions. Their X-Ray lists the names it finds in the book on the device, with no AI, and sends nothing.$lw$) = 0 then
    if strpos(s, $lw$"They can't write public reading logs, join or start book clubs, follow other readers, share lists by link, upload or import books, search Google Books, ask the book's AI assistant, translate passages or use Who's who."$lw$) = 0 then
      raise exception 'xray policies: on the childrens-privacy page, this passage was not found as stored: %', $lw$They can't write public reading logs, join or start book clubs, follow other readers, share lists by link, upload or imp$lw$;
    end if;
    s := replace(s, $lw$"They can't write public reading logs, join or start book clubs, follow other readers, share lists by link, upload or import books, search Google Books, ask the book's AI assistant, translate passages or use Who's who."$lw$, $lw$"They can't write public reading logs, join or start book clubs, follow other readers, share lists by link, upload or import books, search Google Books, ask the book's AI assistant, translate passages or see X-Ray's AI descriptions. Their X-Ray lists the names it finds in the book on the device, with no AI, and sends nothing."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'childrens-privacy'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'terms' for update;
  if s is null then raise exception 'xray policies: the terms page is missing'; end if;
  was := s;
  -- passage 6
  if strpos(s, $lw$14. Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services, including by trying to get around the limits on AI summaries, content notes, Ask the book, Translate, X-Ray, Previously… recaps, chapter quizzes and discussion questions.$lw$) = 0 then
    if strpos(s, $lw$"14. Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services, including by trying to get around the limits on AI summaries, content notes, Ask the book, Translate, Who's who, Previously… recaps, chapter quizzes and discussion questions."$lw$) = 0 then
      raise exception 'xray policies: on the terms page, this passage was not found as stored: %', $lw$14. Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Serv$lw$;
    end if;
    s := replace(s, $lw$"14. Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services, including by trying to get around the limits on AI summaries, content notes, Ask the book, Translate, Who's who, Previously… recaps, chapter quizzes and discussion questions."$lw$, $lw$"14. Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services, including by trying to get around the limits on AI summaries, content notes, Ask the book, Translate, X-Ray, Previously… recaps, chapter quizzes and discussion questions."$lw$);
  end if;
  -- passage 7
  if strpos(s, $lw$Summaries, content notes, Ask the book answers, translations, X-Ray descriptions, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude) and labelled so. They may be wrong; they're provided for your own reading and may not be republished as LiteraryWorm's.$lw$) = 0 then
    if strpos(s, $lw$"Summaries, content notes, Ask the book answers, translations, Who's who, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude) and labelled so. They may be wrong; they're provided for your own reading and may not be republished as LiteraryWorm's."$lw$) = 0 then
      raise exception 'xray policies: on the terms page, this passage was not found as stored: %', $lw$Summaries, content notes, Ask the book answers, translations, Who's who, Previously… recaps, chapter quizzes and discuss$lw$;
    end if;
    s := replace(s, $lw$"Summaries, content notes, Ask the book answers, translations, Who's who, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude) and labelled so. They may be wrong; they're provided for your own reading and may not be republished as LiteraryWorm's."$lw$, $lw$"Summaries, content notes, Ask the book answers, translations, X-Ray descriptions, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude) and labelled so. They may be wrong; they're provided for your own reading and may not be republished as LiteraryWorm's."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'terms'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'acceptable-use' for update;
  if s is null then raise exception 'xray policies: the acceptable-use page is missing'; end if;
  was := s;
  -- passage 8
  if strpos(s, $lw$When you use the AI-powered services provided by LiteraryWorm (\"AI Products\"), you warrant that you will comply with this document, our Legal Terms and all applicable laws and regulations governing AI. Our AI Products are book summaries, content notes, Ask the book, Translate, X-Ray's descriptions (Who's who, places and terms), chapter quizzes, Previously… recaps and book clubs' discussion questions. They're written by Claude, an AI model made by Anthropic, and labelled as written by AI.$lw$) = 0 then
    if strpos(s, $lw$"When you use the AI-powered services provided by LiteraryWorm (\"AI Products\"), you warrant that you will comply with this document, our Legal Terms and all applicable laws and regulations governing AI. Our AI Products are book summaries, content notes, Ask the book, Translate, Who's who, chapter quizzes, Previously… recaps and book clubs' discussion questions. They're written by Claude, an AI model made by Anthropic, and labelled as written by AI."$lw$) = 0 then
      raise exception 'xray policies: on the acceptable-use page, this passage was not found as stored: %', $lw$When you use the AI-powered services provided by LiteraryWorm ("AI Products"), you warrant that you will comply with thi$lw$;
    end if;
    s := replace(s, $lw$"When you use the AI-powered services provided by LiteraryWorm (\"AI Products\"), you warrant that you will comply with this document, our Legal Terms and all applicable laws and regulations governing AI. Our AI Products are book summaries, content notes, Ask the book, Translate, Who's who, chapter quizzes, Previously… recaps and book clubs' discussion questions. They're written by Claude, an AI model made by Anthropic, and labelled as written by AI."$lw$, $lw$"When you use the AI-powered services provided by LiteraryWorm (\"AI Products\"), you warrant that you will comply with this document, our Legal Terms and all applicable laws and regulations governing AI. Our AI Products are book summaries, content notes, Ask the book, Translate, X-Ray's descriptions (Who's who, places and terms), chapter quizzes, Previously… recaps and book clubs' discussion questions. They're written by Claude, an AI model made by Anthropic, and labelled as written by AI."$lw$);
  end if;
  -- passage 9
  if strpos(s, $lw$That's why everything our AI Products write is labelled as written by AI, and why Ask the book and X-Ray are only given the text up to your place in the book, and a quiz only the chapter it's about. A Previously… recap gets only the chapters before yours, and discussion questions only the book up to the end of their chapter. Translate is given only the words you selected, and content notes only the book's details.$lw$) = 0 then
    if strpos(s, $lw$"That's why everything our AI Products write is labelled as written by AI, and why Ask the book and Who's who are only given the text up to your place in the book, and a quiz only the chapter it's about. A Previously… recap gets only the chapters before yours, and discussion questions only the book up to the end of their chapter. Translate is given only the words you selected, and content notes only the book's details."$lw$) = 0 then
      raise exception 'xray policies: on the acceptable-use page, this passage was not found as stored: %', $lw$That's why everything our AI Products write is labelled as written by AI, and why Ask the book and Who's who are only gi$lw$;
    end if;
    s := replace(s, $lw$"That's why everything our AI Products write is labelled as written by AI, and why Ask the book and Who's who are only given the text up to your place in the book, and a quiz only the chapter it's about. A Previously… recap gets only the chapters before yours, and discussion questions only the book up to the end of their chapter. Translate is given only the words you selected, and content notes only the book's details."$lw$, $lw$"That's why everything our AI Products write is labelled as written by AI, and why Ask the book and X-Ray are only given the text up to your place in the book, and a quiz only the chapter it's about. A Previously… recap gets only the chapters before yours, and discussion questions only the book up to the end of their chapter. Translate is given only the words you selected, and content notes only the book's details."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'acceptable-use'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'disclaimer' for update;
  if s is null then raise exception 'xray policies: the disclaimer page is missing'; end if;
  was := s;
  -- passage 10
  if strpos(s, $lw$Book summaries, content notes, Ask the book answers, translations, X-Ray descriptions, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude, made by Anthropic) and labelled as written by AI.$lw$) = 0 then
    if strpos(s, $lw$"Book summaries, content notes, Ask the book answers, translations, Who's who, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude, made by Anthropic) and labelled as written by AI."$lw$) = 0 then
      raise exception 'xray policies: on the disclaimer page, this passage was not found as stored: %', $lw$Book summaries, content notes, Ask the book answers, translations, Who's who, Previously… recaps, chapter quizzes and di$lw$;
    end if;
    s := replace(s, $lw$"Book summaries, content notes, Ask the book answers, translations, Who's who, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude, made by Anthropic) and labelled as written by AI."$lw$, $lw$"Book summaries, content notes, Ask the book answers, translations, X-Ray descriptions, Previously… recaps, chapter quizzes and discussion questions are written by AI (Claude, made by Anthropic) and labelled as written by AI."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'disclaimer'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'status' for update;
  if s is null then raise exception 'xray policies: the status page is missing'; end if;
  was := s;
  -- passage 11
  if strpos(s, $lw$Summaries, Ask the book, X-Ray and chapter quizzes (AI): working normally.$lw$) = 0 then
    if strpos(s, $lw$"Summaries, Ask the book, Who's who and chapter quizzes (AI): working normally."$lw$) = 0 then
      raise exception 'xray policies: on the status page, this passage was not found as stored: %', $lw$Summaries, Ask the book, Who's who and chapter quizzes (AI): working normally.$lw$;
    end if;
    s := replace(s, $lw$"Summaries, Ask the book, Who's who and chapter quizzes (AI): working normally."$lw$, $lw$"Summaries, Ask the book, X-Ray and chapter quizzes (AI): working normally."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'status'; end if;
end
$migration$;
