-- Club reading schedules (lib/clubSchedule.ts, components/ClubSchedule.tsx): the owner sets how
-- many chapters a week, counted from the club's start date; null for no schedule. Members read it
-- with the club; only the owner changes it (the existing "Owners change their clubs" policy).

alter table public.book_clubs
  add column if not exists chapters_per_week smallint check (chapters_per_week between 1 and 100);

grant update (chapters_per_week) on public.book_clubs to authenticated;
