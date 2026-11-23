-- What's new: inviting a friend now gives 20% off one month each instead of a free month (6843-6844).
-- src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-23'::date, '2026.11', 'update', $lw$Invite a friend: 20% off a month for each of you$lw$, $lw$Inviting a friend now earns each of you 20% off one month of your own plan, instead of a free month. When a friend joins with your link and makes their first payment, the credit is added to both accounts and taken off your next bill; on yearly billing a month is a twelfth of the yearly price. You get your credit for inviting once, and every friend you invite gets theirs. Free months you've already earned stay on your account, including any for a friend who joined and paid before this change. See Account → Plan and billing.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Invite a friend: 20% off a month for each of you$lw$ and c.released_on = '2026-11-23');
