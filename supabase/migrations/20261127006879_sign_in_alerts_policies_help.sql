-- Log-in alert emails (6877): the Privacy Policy (18. What we collect) and Help. Same text as src/data/legalPages.json.
--
-- One update per page (one revision row each), and loud: if the passage a paragraph follows isn't there as
-- stored, the migration stops with the page named. Run again, it changes nothing.

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'privacy' for update;
  if s is null then raise exception 'sign-in alerts policies: the privacy page is missing'; end if;
  was := s;
  if strpos(s, $lw$"When someone logs in to your account, our sign-in service records the new session with the browser's description of itself. We copy that description and the time, and a few minutes later email your account's address to say which browser and device logged in and when, unless you've turned these emails off in Account → Sign-in. Mailgun sends it for us. We delete the copy within a day."$lw$) = 0 then
    if strpos(s, $lw$"If you turn on Year in reading, each January we email the year just ended to your account's email address: for every profile in the household, its name, the time it read and listened, the days it read, how many books it finished (naming books from our catalog) and the month it read most. Mailgun sends it for us. We keep only that the year's email was sent."$lw$) = 0 then
      raise exception 'sign-in alerts policies: on the privacy page, this passage was not found as stored: %', $lw$If you turn on Year in reading, each January we email the year just ended to you$lw$;
    end if;
    s := replace(s, $lw$"If you turn on Year in reading, each January we email the year just ended to your account's email address: for every profile in the household, its name, the time it read and listened, the days it read, how many books it finished (naming books from our catalog) and the month it read most. Mailgun sends it for us. We keep only that the year's email was sent."$lw$, $lw$"If you turn on Year in reading, each January we email the year just ended to your account's email address: for every profile in the household, its name, the time it read and listened, the days it read, how many books it finished (naming books from our catalog) and the month it read most. Mailgun sends it for us. We keep only that the year's email was sent.", "When someone logs in to your account, our sign-in service records the new session with the browser's description of itself. We copy that description and the time, and a few minutes later email your account's address to say which browser and device logged in and when, unless you've turned these emails off in Account → Sign-in. Mailgun sends it for us. We delete the copy within a day."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'privacy'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'sign-in alerts policies: the help page is missing'; end if;
  was := s;
  if strpos(s, $lw$"We also email you a few minutes after each new log-in to your account, naming the browser and device and the time. If it wasn't you, change your password and log out on every other device. You can turn these emails off under Where you're logged in."$lw$) = 0 then
    if strpos(s, $lw$"Account → Sign-in also shows where you're logged in: the devices that have had LiteraryWorm open in the last day. If you lose one, or logged in on a computer that isn't yours, choose Log out on every other device. Each is logged out and stops getting notifications, anything still open on one stops within an hour, and you stay logged in where you are."$lw$) = 0 then
      raise exception 'sign-in alerts policies: on the help page, this passage was not found as stored: %', $lw$Account → Sign-in also shows where you're logged in: the devices that have had L$lw$;
    end if;
    s := replace(s, $lw$"Account → Sign-in also shows where you're logged in: the devices that have had LiteraryWorm open in the last day. If you lose one, or logged in on a computer that isn't yours, choose Log out on every other device. Each is logged out and stops getting notifications, anything still open on one stops within an hour, and you stay logged in where you are."$lw$, $lw$"Account → Sign-in also shows where you're logged in: the devices that have had LiteraryWorm open in the last day. If you lose one, or logged in on a computer that isn't yours, choose Log out on every other device. Each is logged out and stops getting notifications, anything still open on one stops within an hour, and you stay logged in where you are.", "We also email you a few minutes after each new log-in to your account, naming the browser and device and the time. If it wasn't you, change your password and log out on every other device. You can turn these emails off under Where you're logged in."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'help'; end if;
end
$migration$;
