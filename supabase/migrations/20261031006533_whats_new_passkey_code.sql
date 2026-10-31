-- What's new: passkeys skip the two-step code (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Passkeys skip the code$lw$, $lw$If you've turned on two-step sign-in, logging in with a passkey no longer asks for the code from your authenticator app: the passkey already needs your device and your face, fingerprint or screen lock. Logging in with your password still asks for the code.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Passkeys skip the code$lw$ and c.version = $lw$2026.10$lw$);
