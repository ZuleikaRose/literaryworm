-- What's new: the new plan prices and Standard's 3 profiles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$New plan prices, and Standard with 3 profiles$lw$, $lw$Basic is now $15.00 a month ($150.00 a year), Standard $20.00 ($200.00) with up to 3 profiles, and Premium $30.00 ($300.00) with up to 12 profiles and unlimited listening. A year is still ten months' price. If you're already a member, your price stays as it is, and a Standard household that already has more than 3 profiles keeps them. Questions about plans now covers each plan's features and more about the app.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$New plan prices, and Standard with 3 profiles$lw$ and c.version = $lw$2026.11$lw$);
