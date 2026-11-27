-- What's new: recovery codes for two-step sign-in (6866). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-27'::date, '2026.11', 'feature', $lw$Recovery codes for two-step sign-in$lw$, $lw$With two-step sign-in on, you can make ten recovery codes in Account → Sign-in and keep them somewhere safe, such as your password manager. If you lose the phone with your authenticator app, choose Lost your phone? Use a recovery code when you log in. Each code works once, and using one turns two-step sign-in off so you can set it up again on your new phone. We keep only one-way hashes of the codes.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Recovery codes for two-step sign-in$lw$ and c.released_on = '2026-11-27');
