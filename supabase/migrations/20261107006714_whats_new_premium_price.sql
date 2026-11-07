-- What's new: Premium's price from migration 6713. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'update', $lw$A new price for Premium$lw$, $lw$From today, Premium is $60.00 a month ($600.00 a year; paying yearly still gets two months free). It keeps up to 12 profiles, unlimited audiobooks, 24 offline devices and up to 12 hours a month of Google's Chirp 3 HD voices for your uploads. Basic ($30.00) and Standard ($40.00) are unchanged. If you're already a member, your price stays as it is.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A new price for Premium$lw$ and c.released_on = '2026-11-07');
