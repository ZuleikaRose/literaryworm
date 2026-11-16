-- Connected apps: members connect an AI assistant (over MCP) or the LiteraryWorm command line to
-- read their own library, places, highlights and reading time. Read-only by construction: the
-- `mcp` Edge Function is its own small OAuth 2.1 server (PKCE, dynamic client registration) and
-- hands apps opaque tokens that mean something only to that function. An app never holds a
-- Supabase session, so it can't reach the tables, Auth or any other function.
--
-- Only the function (service_role) reads and writes these rows; browser roles go through it
-- (the consent page and Account → Sign-in → Connected apps), and it checks the member's session,
-- two-step sign-in and, to approve, the account password.

-- An app that registered itself (RFC 7591). The name is what the app calls itself: the consent
-- page shows it beside where the app sends the member back.
create table public.connected_app_clients (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null check (char_length(btrim(name)) between 1 and 80),
  redirect_uris text[]      not null check (cardinality(redirect_uris) between 1 and 5),
  created_at    timestamptz not null default now()
);

-- One request to connect, from the app opening LiteraryWorm until its code is exchanged (10 minutes
-- to approve, then 5 to exchange). Approving sets the member and the code's SHA-256; the code
-- itself is never stored. Exchanging deletes the row, so a code works once.
create table public.connected_app_requests (
  id             uuid        primary key default gen_random_uuid(),
  client_id      uuid        not null references public.connected_app_clients (id) on delete cascade,
  redirect_uri   text        not null check (char_length(redirect_uri) between 1 and 300),
  -- PKCE, S256 only: base64url of a SHA-256.
  code_challenge text        not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  state          text        check (state is null or char_length(state) <= 512),
  user_id        uuid        references auth.users (id) on delete cascade,
  code_hash      text        unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '10 minutes',
  check ((user_id is null) = (code_hash is null))
);

-- One connection: an app a member approved, with the SHA-256 of its current access token (an hour)
-- and refresh token (90 days from its last use). The tokens themselves are never stored. Removing
-- the row (the member in Account, the app logging out, or the account being deleted) ends it at once.
create table public.connected_apps (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  client_id          uuid        not null references public.connected_app_clients (id) on delete cascade,
  access_hash        text        not null unique check (access_hash ~ '^[0-9a-f]{64}$'),
  access_expires_at  timestamptz not null,
  refresh_hash       text        not null unique check (refresh_hash ~ '^[0-9a-f]{64}$'),
  refresh_expires_at timestamptz not null,
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz
);

alter table public.connected_app_clients enable row level security;
alter table public.connected_app_requests enable row level security;
alter table public.connected_apps enable row level security;

revoke all on public.connected_app_clients from public, anon, authenticated;
revoke all on public.connected_app_requests from public, anon, authenticated;
revoke all on public.connected_apps from public, anon, authenticated;

grant select, insert, update, delete on public.connected_app_clients to service_role;
grant select, insert, update, delete on public.connected_app_requests to service_role;
grant select, insert, update, delete on public.connected_apps to service_role;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch them.
create policy "No browser access to connected app clients"
  on public.connected_app_clients as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No browser access to connection requests"
  on public.connected_app_requests as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No browser access to connected apps"
  on public.connected_apps as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

-- Every hour: requests nobody finished, and connections whose refresh token ran out.
select cron.schedule('connected-app-requests-cleanup', '25 * * * *',
  $$delete from public.connected_app_requests where expires_at < now() - interval '1 hour'$$);

select cron.schedule('connected-apps-cleanup', '35 * * * *',
  $$delete from public.connected_apps where refresh_expires_at < now()$$);

-- Every night: apps that registered a day or more ago and that nobody is connected to or connecting.
select cron.schedule('connected-app-clients-cleanup', '45 3 * * *',
  $$delete from public.connected_app_clients c
     where c.created_at < now() - interval '1 day'
       and not exists (select 1 from public.connected_apps a where a.client_id = c.id)
       and not exists (select 1 from public.connected_app_requests r where r.client_id = c.id)$$);
