-- What's new: Gift cards. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Gift cards$lw$, $lw$On Gifts you can now give a gift card as well as a membership: $25, $50 or $100 of credit for any plan, paid once. Pass the code on or have us email it, now or on a later day; when it's redeemed in Account, the credit comes off the person's next charges, whichever plan they choose.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Gift cards$lw$ and c.released_on = '2026-11-07');
