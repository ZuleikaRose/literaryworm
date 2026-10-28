-- Index for the foreign key on staff_invites (invited_by).
create index concurrently if not exists staff_invites_invited_by_idx on public.staff_invites (invited_by);
