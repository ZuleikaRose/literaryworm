-- What's new: Kids consent verified by a card payment, and the COPPA notice (6830, 6831). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-10'::date, '2026.11', 'update', $lw$Kids profiles: consent confirmed by a card payment$lw$, $lw$Adding a Kids profile now needs a card payment on the account first, such as your membership's first payment. It's how we confirm a parent's consent, as the US children's privacy law (COPPA) asks, and it costs nothing extra. The Children's Privacy Notice now explains COPPA, how we verify consent, that we never share a child's information, how long we keep it and how we keep it safe.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Kids profiles: consent confirmed by a card payment$lw$ and c.released_on = '2026-11-10');
