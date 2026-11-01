-- What's new: up to 20 uploads at a time (src/data/changelog.json has the same). Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$Upload up to 20 books at a time$lw$, $lw$In My Library → Uploads you can now choose up to 20 DRM-free EPUBs at once. Each can still be up to 50 MB, and LiteraryWorm reads them one after another, then tells you which are ready and which weren't added and why.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Upload up to 20 books at a time$lw$ and c.version = $lw$2026.11$lw$);
