-- What's new: log in with a passkey (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Log in with a passkey$lw$, $lw$Add a passkey in Account → Sign-in and log in with your face, fingerprint, screen lock or a security key instead of typing your password. Give each passkey a name you'll recognise, rename it or remove it there too. Your device keeps the passkey, and your face and fingerprint never leave it. If two-step sign-in is on, you'll still enter the code from your app.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Log in with a passkey$lw$ and c.version = $lw$2026.10$lw$);
