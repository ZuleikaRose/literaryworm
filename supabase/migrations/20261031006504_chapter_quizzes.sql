-- Chapter quizzes: for a public-domain title, a few multiple-choice questions about one
-- chapter, written for young readers. The `quiz` Edge Function asks Claude for a chapter's
-- quiz the first time anyone needs it (sending only that chapter's text) and keeps it here,
-- so every later reader gets the same quiz.
--
-- `chapter_quizzes` is the function's alone (service_role); browser roles have no access and
-- go through the function. Nothing in it is about any member.
--
-- `quiz_results` is each profile's score per book and chapter (the latest try), so grown-ups
-- see a Kids profile's quizzes in Account -> Family. Private to the account, like goals.

create table public.chapter_quizzes (
  volume_id     text        not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- 0-based, like the reader's chapter index.
  chapter_index smallint    not null check (chapter_index between 0 and 999),
  -- [{ question, choices, answer, explanation }], checked by the function before it's kept.
  questions     jsonb       not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 3 and 5),
  -- The Claude model that wrote it, so quizzes can be rewritten when the model changes.
  model         text        not null check (char_length(model) between 1 and 80),
  created_at    timestamptz not null default now(),
  primary key (volume_id, chapter_index)
);

alter table public.chapter_quizzes enable row level security;
revoke all on public.chapter_quizzes from public, anon, authenticated;

create policy "No browser access to chapter quizzes"
  on public.chapter_quizzes as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

create table public.quiz_results (
  profile_id    uuid        not null,
  user_id       uuid        not null,
  volume_id     text        not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  chapter_index smallint    not null check (chapter_index between 0 and 999),
  score         smallint    not null check (score between 0 and 5),
  out_of        smallint    not null check (out_of between 3 and 5 and score <= out_of),
  taken_at      timestamptz not null default now(),
  -- Leads with (profile_id, user_id), so it also indexes the foreign key.
  primary key (profile_id, user_id, volume_id, chapter_index),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.quiz_results enable row level security;

create policy "Readers see their household's quiz results" on public.quiz_results for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers record quiz results for their own profiles" on public.quiz_results for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers record a new try" on public.quiz_results for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers remove quiz results" on public.quiz_results for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.quiz_results as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.quiz_results from anon, authenticated;
grant select, delete on public.quiz_results to authenticated;
grant insert (profile_id, user_id, volume_id, chapter_index, score, out_of, taken_at) on public.quiz_results to authenticated;
grant update (score, out_of, taken_at) on public.quiz_results to authenticated;
