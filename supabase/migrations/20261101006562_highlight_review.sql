-- Highlights review (lib/highlightReview.ts): spaced repetition for a reader's highlights, like
-- word review (saved_words.review_due, migration 6521). review_due is the next review day on the
-- reader's own calendar (null until the first review: a new highlight is due the day after it's
-- made); review_step counts the times in a row it still mattered (0–6; after 6 it comes back
-- every 60 days). Members change only these two columns and colour and note; RLS is unchanged
-- (the existing owner policies and the second-step policy cover it).

alter table public.highlights
  add column review_due  date,
  add column review_step smallint not null default 0 check (review_step between 0 and 6);

grant update (review_due, review_step) on public.highlights to authenticated;
