-- What's new: the affiliate program (6679). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'feature', $lw$The affiliate program$lw$, $lw$Recommend LiteraryWorm and earn credit: members can apply on the new Affiliate program page in the footer. Once you're approved, you get your own sign-up link, and when someone joins with it and makes their first payment, 20% of that payment is added to your membership as credit. You see visits, sign-ups and credit earned, never who signed up. Affiliates say they earn a commission wherever they share, and never aim it at children.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$The affiliate program$lw$ and c.version = '2026.11');
