-- What's new: the FAQ's read-along and affiliate questions. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'update', $lw$Two new questions in the FAQ$lw$, $lw$The FAQ on Home and Plans now answers whether you can read along while you listen, and how to earn credit by recommending LiteraryWorm through the affiliate program.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Two new questions in the FAQ$lw$ and c.version = '2026.11');
