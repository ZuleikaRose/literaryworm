-- Index for the foreign key on staff_roles (granted_by).
create index concurrently if not exists staff_roles_granted_by_idx on public.staff_roles (granted_by);
