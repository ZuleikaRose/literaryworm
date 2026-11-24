-- Who's who's own cache is retired: X-Ray (the `xray` function, book_xray, migration 6860)
-- replaced it, the app no longer calls the `characters` function, and that function is removed
-- from the repository. The table holds only Claude-written character lists for public-domain
-- books (nothing about any member), so dropping it loses nothing X-Ray needs.
--
-- Go-live order: this is the very last step, applied on its own (never with `db push` and the
-- others): promote the app, undeploy the `characters` function, then apply this, so a tab
-- opened before the release never meets a function without its table.

drop table if exists public.book_characters;
