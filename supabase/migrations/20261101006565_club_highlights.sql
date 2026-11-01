-- Shared highlights in book clubs: a member shares one of their own highlights of the club's
-- book with the club; the other members see it on the club's page, hidden past their own chapter
-- like posts (spoilerFreeUpTo() in lib/clubs.ts). The browser sends only the club, the highlight
-- and whether to include the note: a trigger copies the passage, chapter and colour (and the note,
-- if asked) from the member's own highlight, so a shared passage is always really from the book
-- and in the chapter it says. Deleting the highlight, leaving the club or deleting the club
-- removes the shared copy. Up to 300 per member per club. Indexes for the foreign keys in the
-- next two migrations.

create table public.club_highlights (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null,
  user_id       uuid not null,
  highlight_id  uuid not null references public.highlights (id) on delete cascade,
  share_note    boolean not null default true,
  chapter_index smallint not null default 0 check (chapter_index between 0 and 999),
  quote         text not null default '' check (char_length(quote) <= 2000),
  color         public.highlight_color not null default 'yellow',
  note          text check (char_length(note) <= 2000),
  created_at    timestamptz not null default now(),
  unique (club_id, highlight_id),
  -- Only members share; leaving the club removes the membership and these.
  foreign key (club_id, user_id) references public.club_members (club_id, user_id) on delete cascade
);

create or replace function private.club_highlights_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_highlight public.highlights%rowtype;
begin
  select * into v_highlight from public.highlights h where h.id = new.highlight_id and h.user_id = new.user_id;
  if not found then
    raise exception 'Share one of your own highlights' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.book_clubs c where c.id = new.club_id and c.volume_id = v_highlight.volume_id) then
    raise exception 'Share a highlight from the club''s book' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.club_highlights x where x.club_id = new.club_id and x.user_id = new.user_id) >= 300 then
    raise exception 'You can share up to 300 highlights in a club' using errcode = 'check_violation';
  end if;
  new.chapter_index := v_highlight.chapter_index;
  new.quote := v_highlight.quote;
  new.color := v_highlight.color;
  new.note := case when new.share_note then v_highlight.note else null end;
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function private.club_highlights_fill() from public, anon, authenticated;

create trigger club_highlights_fill
  before insert on public.club_highlights
  for each row execute function private.club_highlights_fill();

alter table public.club_highlights enable row level security;

create policy "Members see their club's shared highlights" on public.club_highlights for select to authenticated
  using (public.is_club_member(club_id));
create policy "Members share their own highlights" on public.club_highlights for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_club_member(club_id));
create policy "Members stop sharing their own highlights" on public.club_highlights for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.club_highlights as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.club_highlights from anon, authenticated;
grant select, delete on public.club_highlights to authenticated;
grant insert (club_id, user_id, highlight_id, share_note) on public.club_highlights to authenticated;
