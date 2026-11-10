-- What's new: the menu's Plans link is now Pricing; added to the entry from 6826. src/data/changelog.json has the same.

update public.changelog_entries
set body = $lw$Plans and pricing now lives at www.literaryworm.com/pricing, and the menu calls it Pricing. Old links to /plans still work and take you straight there.$lw$
where title = $lw$Plans and pricing has a new address$lw$ and released_on = '2026-11-10';
