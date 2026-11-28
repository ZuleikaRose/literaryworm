-- Connected apps that may change the library (MCP, scope "library"): an app asks for it, the consent
-- page says so and the member can leave it off. Without it a connection only reads, as before.
--
-- * connected_app_requests.scope: what the app asked for ("read" or "read library").
-- * connected_apps.scope: what the member granted. The mcp function lists and runs the library
--   tools (add_to_library, set_book_status) only for "read library". Nothing can remove a book,
--   and books read on a Kids profile are never touched.
-- Service role only, like the rest of these tables.

alter table public.connected_app_requests
  add column scope text not null default 'read' check (scope in ('read', 'read library'));
alter table public.connected_apps
  add column scope text not null default 'read' check (scope in ('read', 'read library'));
