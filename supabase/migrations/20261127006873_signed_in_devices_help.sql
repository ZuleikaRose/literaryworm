-- Where you're logged in and Log out on every other device (Account → Sign-in): Help. Same text as src/data/legalPages.json.
--
-- One update (one revision row), and loud: if the passage it follows isn't there as stored, the migration stops.
-- Run again, it changes nothing.

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'signed-in devices help: the help page is missing'; end if;
  was := s;
  if strpos(s, $lw$"Account → Sign-in also shows where you're logged in: the devices that have had LiteraryWorm open in the last day. If you lose one, or logged in on a computer that isn't yours, choose Log out on every other device. Each is logged out and stops getting notifications, anything still open on one stops within an hour, and you stay logged in where you are."$lw$) = 0 then
    if strpos(s, $lw$"You can also turn on two-step sign-in there, so logging in with your password also asks for a code from an authenticator app on your phone. Then make recovery codes in the same place and keep them somewhere safe, such as your password manager. If you lose the phone, choose Lost your phone? Use a recovery code when you're asked for the code. Each code works once, and using one turns two-step sign-in off, so set it up again on your new phone and make new codes."$lw$) = 0 then
      raise exception 'signed-in devices help: on the help page, this passage was not found as stored: %', $lw$You can also turn on two-step sign-in there, so logging in with your password also asks $lw$;
    end if;
    s := replace(s, $lw$"You can also turn on two-step sign-in there, so logging in with your password also asks for a code from an authenticator app on your phone. Then make recovery codes in the same place and keep them somewhere safe, such as your password manager. If you lose the phone, choose Lost your phone? Use a recovery code when you're asked for the code. Each code works once, and using one turns two-step sign-in off, so set it up again on your new phone and make new codes."$lw$, $lw$"You can also turn on two-step sign-in there, so logging in with your password also asks for a code from an authenticator app on your phone. Then make recovery codes in the same place and keep them somewhere safe, such as your password manager. If you lose the phone, choose Lost your phone? Use a recovery code when you're asked for the code. Each code works once, and using one turns two-step sign-in off, so set it up again on your new phone and make new codes.", "Account → Sign-in also shows where you're logged in: the devices that have had LiteraryWorm open in the last day. If you lose one, or logged in on a computer that isn't yours, choose Log out on every other device. Each is logged out and stops getting notifications, anything still open on one stops within an hour, and you stay logged in where you are."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'help'; end if;
end
$migration$;
