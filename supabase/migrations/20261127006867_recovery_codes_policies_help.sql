-- Recovery codes for two-step sign-in (6866): Help and the Privacy Policy. Same text as src/data/legalPages.json.
--
-- One update per page (so one revision row each), and loud: a passage that's neither in its old wording nor already
-- in its new one stops the migration with the page and the passage named. Run again, it changes nothing.

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'recovery codes policies: the help page is missing'; end if;
  was := s;
  -- passage 1: a paragraph after "In Account → Sign-in you can add a passkey to log …"; never added twice.
  if strpos(s, $lw$"You can also turn on two-step sign-in there, so logging in with your password also asks for a code from an authenticator app on your phone. Then make recovery codes in the same place and keep them somewhere safe, such as your password manager. If you lose the phone, choose Lost your phone? Use a recovery code when you're asked for the code. Each code works once, and using one turns two-step sign-in off, so set it up again on your new phone and make new codes."$lw$) = 0 then
    if strpos(s, $lw$"In Account → Sign-in you can add a passkey to log in with your face, fingerprint, screen lock or a security key instead of your password, and rename or remove passkeys you no longer use."$lw$) = 0 then
      raise exception 'recovery codes policies: on the help page, this passage was not found as stored: %', $lw$In Account → Sign-in you can add a passkey to log in with your face, fingerprint, screen lock or a security key instead $lw$;
    end if;
    s := replace(s, $lw$"In Account → Sign-in you can add a passkey to log in with your face, fingerprint, screen lock or a security key instead of your password, and rename or remove passkeys you no longer use."$lw$, $lw$"In Account → Sign-in you can add a passkey to log in with your face, fingerprint, screen lock or a security key instead of your password, and rename or remove passkeys you no longer use.", "You can also turn on two-step sign-in there, so logging in with your password also asks for a code from an authenticator app on your phone. Then make recovery codes in the same place and keep them somewhere safe, such as your password manager. If you lose the phone, choose Lost your phone? Use a recovery code when you're asked for the code. Each code works once, and using one turns two-step sign-in off, so set it up again on your new phone and make new codes."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'help'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'privacy' for update;
  if s is null then raise exception 'recovery codes policies: the privacy page is missing'; end if;
  was := s;
  -- passage 2
  if strpos(s, $lw$"How do we keep your information safe? Connections use HTTPS, our database lets each account read only its own data, passwords, PINs and recovery codes are kept only as one-way hashes, and you can add two-step sign-in or passkeys."$lw$) = 0 then
    if strpos(s, $lw$"How do we keep your information safe? Connections use HTTPS, our database lets each account read only its own data, passwords and PINs are kept only as one-way hashes, and you can add two-step sign-in or passkeys."$lw$) = 0 then
      raise exception 'recovery codes policies: on the privacy page, this passage was not found as stored: %', $lw$How do we keep your information safe? Connections use HTTPS, our database lets each account read only its own data, pass$lw$;
    end if;
    s := replace(s, $lw$"How do we keep your information safe? Connections use HTTPS, our database lets each account read only its own data, passwords and PINs are kept only as one-way hashes, and you can add two-step sign-in or passkeys."$lw$, $lw$"How do we keep your information safe? Connections use HTTPS, our database lets each account read only its own data, passwords, PINs and recovery codes are kept only as one-way hashes, and you can add two-step sign-in or passkeys."$lw$);
  end if;
  -- passage 3
  if strpos(s, $lw$"Passwords, profile PINs and two-step sign-in's recovery codes are kept only as one-way hashes. You can turn on two-step sign-in or log in with a passkey, staff can see only what their role needs, and every support lookup is recorded."$lw$) = 0 then
    if strpos(s, $lw$"Passwords and profile PINs are kept only as one-way hashes. You can turn on two-step sign-in or log in with a passkey, staff can see only what their role needs, and every support lookup is recorded."$lw$) = 0 then
      raise exception 'recovery codes policies: on the privacy page, this passage was not found as stored: %', $lw$Passwords and profile PINs are kept only as one-way hashes. You can turn on two-step sign-in or log in with a passkey, s$lw$;
    end if;
    s := replace(s, $lw$"Passwords and profile PINs are kept only as one-way hashes. You can turn on two-step sign-in or log in with a passkey, staff can see only what their role needs, and every support lookup is recorded."$lw$, $lw$"Passwords, profile PINs and two-step sign-in's recovery codes are kept only as one-way hashes. You can turn on two-step sign-in or log in with a passkey, staff can see only what their role needs, and every support lookup is recorded."$lw$);
  end if;
  -- passage 4: a paragraph after "Your password is handled by our sign-in provider a…"; never added twice.
  if strpos(s, $lw$"If you make recovery codes for two-step sign-in, we keep only a one-way hash of each code and when they were made; the codes themselves are shown to you once and never stored. Using one turns two-step sign-in off and deletes them all, and so do making a new set, turning two-step sign-in off and deleting your account."$lw$) = 0 then
    if strpos(s, $lw$"Your password is handled by our sign-in provider and kept only as a one-way hash; we never see it. If you add passkeys, our sign-in provider keeps each one's public key, its name and when it was added and last used; the private key stays on your device, browser or password manager, and your face or fingerprint never leaves your device."$lw$) = 0 then
      raise exception 'recovery codes policies: on the privacy page, this passage was not found as stored: %', $lw$Your password is handled by our sign-in provider and kept only as a one-way hash; we never see it. If you add passkeys, $lw$;
    end if;
    s := replace(s, $lw$"Your password is handled by our sign-in provider and kept only as a one-way hash; we never see it. If you add passkeys, our sign-in provider keeps each one's public key, its name and when it was added and last used; the private key stays on your device, browser or password manager, and your face or fingerprint never leaves your device."$lw$, $lw$"Your password is handled by our sign-in provider and kept only as a one-way hash; we never see it. If you add passkeys, our sign-in provider keeps each one's public key, its name and when it was added and last used; the private key stays on your device, browser or password manager, and your face or fingerprint never leaves your device.", "If you make recovery codes for two-step sign-in, we keep only a one-way hash of each code and when they were made; the codes themselves are shown to you once and never stored. Using one turns two-step sign-in off and deletes them all, and so do making a new set, turning two-step sign-in off and deleting your account."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'privacy'; end if;
end
$migration$;
