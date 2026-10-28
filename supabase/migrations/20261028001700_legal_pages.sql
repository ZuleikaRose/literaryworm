-- Staff roles, and editable legal pages (Phase 22).
--
-- staff_roles gives accounts access beyond being a member: admin (everything,
-- including granting roles), editor (the legal pages), and developer, billing,
-- customer_service and blog (recorded for the tools that will use them). An
-- account can hold several. Roles are granted and removed only by admins,
-- through grant_staff_role() and revoke_staff_role(); a role granted to an
-- email with no account yet waits in staff_invites and is applied when that
-- email signs up. A member sees only their own roles; admins see the team
-- through staff_members().
--
-- legal_pages holds the live copy of each footer page (Terms, Privacy,
-- Cookies, Copyright/DMCA, Accessibility, Children's Privacy, Privacy Choices,
-- Help, Status): anyone reads them; editors and admins change a page's title,
-- summary and sections. Each change stamps who made it and when and keeps the
-- page as it was in legal_page_revisions. Pages aren't added or removed from
-- the browser: the set is fixed with the footer.

create type public.staff_role as enum ('admin', 'developer', 'editor', 'billing', 'customer_service', 'blog');

create table public.staff_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.staff_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

-- Roles for emails that haven't signed up yet.
create table public.staff_invites (
  email      text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  role       public.staff_role not null,
  invited_at timestamptz not null default now(),
  invited_by uuid references auth.users (id) on delete set null,
  primary key (email, role)
);

alter table public.staff_roles enable row level security;
alter table public.staff_invites enable row level security;
create policy "Members see their own roles" on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()));
-- No browser access to staff_invites: admins reach it through the functions below.
revoke all on public.staff_roles, public.staff_invites from anon, authenticated;
grant select on public.staff_roles to authenticated;

-- True when the caller holds the role, or is an admin (admins can do everything).
-- SECURITY INVOKER: it reads the caller's own rows.
create function public.has_staff_role(p_role public.staff_role)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = (select auth.uid()) and role in (p_role, 'admin')
  );
$$;
revoke execute on function public.has_staff_role(public.staff_role) from public, anon;
grant execute on function public.has_staff_role(public.staff_role) to authenticated;

-- The team, for admins: every account with a role, and every waiting invitation.
-- SECURITY DEFINER because it reads emails from auth.users; it checks the caller
-- is an admin first.
create function public.staff_members()
returns table (user_id uuid, email text, display_name text, roles public.staff_role[], invited boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_role('admin') then
    raise exception 'Only admins can see the team' using errcode = 'insufficient_privilege';
  end if;
  return query
    select s.user_id, lower(u.email)::text, p.display_name, array_agg(s.role order by s.role), false
      from public.staff_roles s
      join auth.users u on u.id = s.user_id
      left join public.profiles p on p.id = s.user_id
     group by s.user_id, u.email, p.display_name
    union all
    select null::uuid, i.email, null::text, array_agg(i.role order by i.role), true
      from public.staff_invites i
     group by i.email
     order by 2;
end;
$$;

-- Gives an account a role, by email. With no account for that email yet, the
-- role waits as an invitation. Returns 'granted' or 'invited'. Admins only.
create function public.grant_staff_role(p_email text, p_role public.staff_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
begin
  if not public.has_staff_role('admin') then
    raise exception 'Only admins can grant access' using errcode = 'insufficient_privilege';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'That isn''t an email address' using errcode = 'check_violation';
  end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    insert into public.staff_invites (email, role, invited_by) values (v_email, p_role, (select auth.uid()))
    on conflict do nothing;
    return 'invited';
  end if;
  insert into public.staff_roles (user_id, role, granted_by) values (v_user, p_role, (select auth.uid()))
  on conflict do nothing;
  return 'granted';
end;
$$;

-- Takes a role away (or withdraws an invitation, by email). Admins only; the
-- last admin can't be removed, so the team can't lock itself out.
create function public.revoke_staff_role(p_email text, p_role public.staff_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
begin
  if not public.has_staff_role('admin') then
    raise exception 'Only admins can remove access' using errcode = 'insufficient_privilege';
  end if;
  delete from public.staff_invites where email = v_email and role = p_role;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    return;
  end if;
  if p_role = 'admin' and (select count(*) from public.staff_roles where role = 'admin') <= 1
     and exists (select 1 from public.staff_roles where user_id = v_user and role = 'admin') then
    raise exception 'LiteraryWorm needs at least one admin' using errcode = 'check_violation';
  end if;
  delete from public.staff_roles where user_id = v_user and role = p_role;
end;
$$;

revoke execute on function public.staff_members(), public.grant_staff_role(text, public.staff_role), public.revoke_staff_role(text, public.staff_role) from public, anon;
grant execute on function public.staff_members(), public.grant_staff_role(text, public.staff_role), public.revoke_staff_role(text, public.staff_role) to authenticated;

-- A new account picks up any roles waiting for its email.
create function private.apply_staff_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_roles (user_id, role, granted_by)
  select new.id, i.role, i.invited_by from public.staff_invites i where i.email = lower(new.email)
  on conflict do nothing;
  delete from public.staff_invites where email = lower(new.email);
  return new;
end;
$$;
revoke execute on function private.apply_staff_invites() from public, anon, authenticated;

create trigger apply_staff_invites
  after insert on auth.users
  for each row execute function private.apply_staff_invites();

create table public.legal_pages (
  slug       text primary key check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  position   smallint not null check (position between 0 and 99),
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  summary    text not null check (char_length(btrim(summary)) between 1 and 600),
  -- Each section's shape is checked by the edit trigger below.
  sections   jsonb not null default '[]' check (jsonb_typeof(sections) = 'array' and octet_length(sections::text) <= 200000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.legal_page_revisions (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null references public.legal_pages (slug) on delete cascade,
  title     text not null,
  summary   text not null,
  sections  jsonb not null,
  -- When this version was replaced, and by whom.
  replaced_at timestamptz not null default now(),
  replaced_by uuid references auth.users (id) on delete set null
);

alter table public.legal_pages enable row level security;
alter table public.legal_page_revisions enable row level security;

create policy "Anyone reads the legal pages" on public.legal_pages for select to anon, authenticated
  using (true);
create policy "Editors edit the legal pages" on public.legal_pages for update to authenticated
  using ((select public.has_staff_role('editor'))) with check ((select public.has_staff_role('editor')));
create policy "Editors read earlier versions" on public.legal_page_revisions for select to authenticated
  using ((select public.has_staff_role('editor')));
create policy "Edits record earlier versions" on public.legal_page_revisions for insert to authenticated
  with check ((select public.has_staff_role('editor')) and replaced_by = (select auth.uid()));

revoke all on public.legal_pages, public.legal_page_revisions from anon, authenticated;
grant select on public.legal_pages to anon, authenticated;
grant update (title, summary, sections) on public.legal_pages to authenticated;
grant select on public.legal_page_revisions to authenticated;
grant insert (slug, title, summary, sections, replaced_by) on public.legal_page_revisions to authenticated;

-- Each edit: check the sections, keep the page as it was, then stamp who
-- changed it and when. (The check is here rather than in a constraint so it
-- runs without editors needing the private schema.)
create function private.record_legal_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An array of up to 40 { heading, paragraphs[] }: a heading of 1-120 characters and 1-60
  -- paragraphs of 1-5000 characters each.
  if jsonb_array_length(new.sections) > 40 or exists (
    select 1 from jsonb_array_elements(new.sections) sec
    where jsonb_typeof(sec) <> 'object'
       or jsonb_typeof(sec -> 'heading') is distinct from 'string'
       or char_length(btrim(sec ->> 'heading')) not between 1 and 120
       or jsonb_typeof(sec -> 'paragraphs') is distinct from 'array'
       or jsonb_array_length(sec -> 'paragraphs') not between 1 and 60
       or exists (
         select 1 from jsonb_array_elements(sec -> 'paragraphs') para
         where jsonb_typeof(para) <> 'string' or char_length(btrim(para #>> '{}')) not between 1 and 5000
       )
  ) then
    raise exception 'Each section needs a heading (up to 120 characters) and 1 to 60 paragraphs of up to 5000 characters; up to 40 sections'
      using errcode = 'check_violation';
  end if;
  if (new.title, new.summary, new.sections) is not distinct from (old.title, old.summary, old.sections) then
    return new;
  end if;
  insert into public.legal_page_revisions (slug, title, summary, sections, replaced_by)
  values (old.slug, old.title, old.summary, old.sections, (select auth.uid()));
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
revoke execute on function private.record_legal_edit() from public, anon, authenticated;

create trigger legal_pages_record_edit
  before update on public.legal_pages
  for each row execute function private.record_legal_edit();
