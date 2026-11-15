-- What's new: the public pages' new look and the header's light and dark switch. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-15'::date, '2026.11', 'update', $lw$A fresh look for the public pages, and a light and dark switch$lw$, $lw$The home page, Pricing and What's new have a new look: larger headings, fuller cards and rounder buttons, laid out for phones, tablets and computers. The site still opens in dark, and visitors can now switch between light and dark with one press in the header. Members keep the same choice in the accessibility menu.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A fresh look for the public pages, and a light and dark switch$lw$ and c.released_on = '2026-11-15');
