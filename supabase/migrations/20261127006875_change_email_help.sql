-- Changing the email address (Account → Sign-in): Help. Same text as src/data/legalPages.json.
--
-- One update (one revision row), and loud: if the passage it goes before isn't there as stored, the migration stops.
-- Run again, it changes nothing.

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'change email help: the help page is missing'; end if;
  was := s;
  if strpos(s, $lw$"To change your email address, choose Change email address in Account → Sign-in and enter the new one with your account password. We send a link to both addresses, and the change happens once you've followed both; your old address then gets a note that it changed. Your receipts go to the new address too."$lw$) = 0 then
    if strpos(s, $lw$"In Account → Sign-in you can add a passkey to log in with your face, fingerprint, screen lock or a security key instead of your password, and rename or remove passkeys you no longer use."$lw$) = 0 then
      raise exception 'change email help: on the help page, this passage was not found as stored: %', $lw$In Account → Sign-in you can add a passkey to log in $lw$;
    end if;
    s := replace(s, $lw$"In Account → Sign-in you can add a passkey to log in with your face, fingerprint, screen lock or a security key instead of your password, and rename or remove passkeys you no longer use."$lw$, $lw$"To change your email address, choose Change email address in Account → Sign-in and enter the new one with your account password. We send a link to both addresses, and the change happens once you've followed both; your old address then gets a note that it changed. Your receipts go to the new address too.", "In Account → Sign-in you can add a passkey to log in with your face, fingerprint, screen lock or a security key instead of your password, and rename or remove passkeys you no longer use."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'help'; end if;
end
$migration$;
