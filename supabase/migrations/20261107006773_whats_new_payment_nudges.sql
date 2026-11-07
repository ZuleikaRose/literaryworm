-- What's new: A heads-up when a payment fails. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'update', $lw$A heads-up when a payment fails$lw$, $lw$If a membership payment doesn't go through, we now email you once and the bell reminds you each day, with a link to update your payment method, so your membership carries on without a gap.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A heads-up when a payment fails$lw$ and c.released_on = '2026-11-07');
