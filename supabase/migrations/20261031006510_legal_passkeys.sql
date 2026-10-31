-- Passkeys (src/data/legalPages.json has the same change): the Privacy Policy says what the sign-in
-- provider keeps for a passkey (the public key, a name, when it was added and last used) and that faces
-- and fingerprints never leave the device; the Cookie Policy that passkeys aren't in the app's browser
-- storage; Help how to add, rename and remove them. A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Your password is handled by our sign-in provider and kept only as a one-way hash; we never see it.$lw$, $lw$Your password is handled by our sign-in provider and kept only as a one-way hash; we never see it. If you add passkeys, our sign-in provider keeps each one's public key, its name and when it was added and last used; the private key stays on your device, browser or password manager, and your face or fingerprint never leaves your device. You can rename or remove passkeys in Account → Sign-in, and Download my data lists them.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Your password is handled by our sign-in provider and kept only as a one-way hash; we never see it.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$it's removed when you log out too.$lw$, $lw$it's removed when you log out too. Passkeys you add are kept by your device, browser or password manager, not by LiteraryWorm in your browser's storage, and logging out doesn't remove them.$lw$)::jsonb, updated_at = now()
where slug = $lw$cookies$lw$
  and strpos(sections::text, $lw$it's removed when you log out too.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and change your plan, password or emails in Account.$lw$, $lw$and change your plan, password or emails in Account. In Account → Sign-in you can add a passkey to log in with your face, fingerprint, screen lock or a security key instead of your password, and rename or remove passkeys you no longer use.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$and change your plan, password or emails in Account.$lw$) > 0;
