-- My words review (spaced repetition): when each word is next asked, and how many times in a
-- row it was known (lib/words.ts: 1, 3, 7, 14, 30 and 60 days). A word never reviewed has no
-- due day and is asked straight away. The browser updates these with `learned`, which the last
-- step sets.

alter table public.saved_words
  add column review_due  date,
  add column review_step smallint not null default 0 check (review_step between 0 and 6);

grant update (learned, review_due, review_step) on public.saved_words to authenticated;
