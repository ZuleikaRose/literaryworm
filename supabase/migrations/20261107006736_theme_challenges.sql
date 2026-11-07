-- Themes covered challenges (lib/challenges.ts THEME_PROMPTS): a fourth kind of household
-- challenge whose target is how many of the nine themes to cover. Progress is still worked out in
-- the browser from finished books, never stored.

alter table public.household_challenges drop constraint if exists household_challenges_kind_check;
alter table public.household_challenges
  add constraint household_challenges_kind_check check (kind in ('books', 'hours', 'days', 'themes'));
alter table public.household_challenges drop constraint if exists household_challenges_themes_target_check;
alter table public.household_challenges
  add constraint household_challenges_themes_target_check check (kind <> 'themes' or target <= 9);
