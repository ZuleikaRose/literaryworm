-- What's new: yearly to monthly at renewal (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Yearly members can switch to monthly$lw$, $lw$If you pay yearly, you can now choose monthly billing on the Plans page. Your year carries on as it is, and monthly billing starts on your renewal date. Changed your mind? Keep yearly billing in Account.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Yearly members can switch to monthly$lw$ and c.version = $lw$2026.10$lw$);
