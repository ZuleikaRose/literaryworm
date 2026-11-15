-- What's new: every entry shows a Major or a Minor label. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-15'::date, '2026.11', 'update', $lw$What's new: every change is labelled Major or Minor$lw$, $lw$Each change on What's new now carries a Major or a Minor label beside its kind, so you can tell the big changes from the small ones without using the filters.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$What's new: every change is labelled Major or Minor$lw$ and c.released_on = '2026-11-15');
