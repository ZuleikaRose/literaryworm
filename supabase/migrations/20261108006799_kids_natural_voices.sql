-- Natural voices for a Kids profile, with a grown-up's say-so: off until a grown-up turns them on
-- in Account → Family (the manage-profile function's set_kids_voices, which re-checks the account
-- password). The browser can read it, never write it. The natural-voice function then voices that
-- profile's uploads, counted against the household's hours like everyone else's.

alter table public.reader_profiles add column if not exists kids_natural_voices boolean not null default false;
comment on column public.reader_profiles.kids_natural_voices is
  'Kids profiles only: a grown-up allowed natural voices for this profile''s uploads. Written only by manage-profile (set_kids_voices).';
grant select (kids_natural_voices) on public.reader_profiles to authenticated;
