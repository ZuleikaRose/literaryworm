-- What's new: the pricing page's label above its heading is now Pricing too; the entry from 6826-6828 says so. src/data/changelog.json has the same.

update public.changelog_entries
set body = $lw$Plans and pricing now lives at www.literaryworm.com/pricing, and the menu, the footer and the page itself call it Pricing. Old links to /plans still work and take you straight there.$lw$
where title = $lw$Plans and pricing has a new address$lw$ and released_on = '2026-11-10';
