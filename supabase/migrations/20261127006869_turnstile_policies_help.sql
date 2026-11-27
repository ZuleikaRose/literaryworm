-- Cloudflare Turnstile on the log-in, sign-up, password reset and resend-email forms: the Privacy Policy, the
-- Cookie Policy and Help. Same text as src/data/legalPages.json.
--
-- One update per page (so one revision row each), and loud: a passage that's neither in its old wording nor already
-- in its new one stops the migration with the page and the passage named. Run again, it changes nothing.

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'privacy' for update;
  if s is null then raise exception 'turnstile policies: the privacy page is missing'; end if;
  was := s;
  -- passage 1: after "Ahrefs Web Analytics counts visits so we can see w…"; never added twice.
  if strpos(s, $lw$"Cloudflare Turnstile checks that a person, not a bot, is logging in, signing up, resetting a password or asking for the confirmation email again. Those forms load it from challenges.cloudflare.com, and it sends Cloudflare your IP address and details of your browser and device, and runs small checks in your browser."$lw$) = 0 then
    if strpos(s, $lw$"Ahrefs Web Analytics counts visits so we can see which pages people use. If you allow analytics in the consent banner, your browser sends Ahrefs (analytics.ahrefs.com) the pages you visit, their titles, the site you came from, your screen size and language, and links you follow to other sites. Ahrefs also receives your IP address and browser details with each request."$lw$) = 0 then
      raise exception 'turnstile policies: on the privacy page, this passage was not found as stored: %', $lw$Ahrefs Web Analytics counts visits so we can see which pages people use. If you allow analytics in the consent banner, y$lw$;
    end if;
    s := replace(s, $lw$"Ahrefs Web Analytics counts visits so we can see which pages people use. If you allow analytics in the consent banner, your browser sends Ahrefs (analytics.ahrefs.com) the pages you visit, their titles, the site you came from, your screen size and language, and links you follow to other sites. Ahrefs also receives your IP address and browser details with each request."$lw$, $lw$"Ahrefs Web Analytics counts visits so we can see which pages people use. If you allow analytics in the consent banner, your browser sends Ahrefs (analytics.ahrefs.com) the pages you visit, their titles, the site you came from, your screen size and language, and links you follow to other sites. Ahrefs also receives your IP address and browser details with each request.", "Cloudflare Turnstile checks that a person, not a bot, is logging in, signing up, resetting a password or asking for the confirmation email again. Those forms load it from challenges.cloudflare.com, and it sends Cloudflare your IP address and details of your browser and device, and runs small checks in your browser.", "We receive only a pass from Turnstile, which our sign-in provider checks with Cloudflare before going on. Cloudflare handles what Turnstile collects under its own privacy policy. The demo doesn't use it."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'privacy'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'cookies' for update;
  if s is null then raise exception 'turnstile policies: the cookies page is missing'; end if;
  was := s;
  -- passage 2
  if strpos(s, $lw$"The cookies set when you use LiteraryWorm all come from other companies: Cloudflare's bot check on our backend, Cloudflare's security check on the log-in and sign-up forms, and Google's cookies from books.google.com when Google Books covers and previews load."$lw$) = 0 then
    if strpos(s, $lw$"Two kinds of cookie are set when you use LiteraryWorm, both by other companies: Cloudflare's bot check on our backend, and Google's cookies from books.google.com when Google Books covers and previews load."$lw$) = 0 then
      raise exception 'turnstile policies: on the cookies page, this passage was not found as stored: %', $lw$Two kinds of cookie are set when you use LiteraryWorm, both by other companies: Cloudflare's bot check on our backend, a$lw$;
    end if;
    s := replace(s, $lw$"Two kinds of cookie are set when you use LiteraryWorm, both by other companies: Cloudflare's bot check on our backend, and Google's cookies from books.google.com when Google Books covers and previews load."$lw$, $lw$"The cookies set when you use LiteraryWorm all come from other companies: Cloudflare's bot check on our backend, Cloudflare's security check on the log-in and sign-up forms, and Google's cookies from books.google.com when Google Books covers and previews load."$lw$);
  end if;
  -- passage 3: after "Ahrefs (analytics.ahrefs.com) serves our visit cou…"; never added twice.
  if strpos(s, $lw$"Cloudflare Turnstile (challenges.cloudflare.com) is the security check on the log-in, sign-up, password reset and resend-email forms. It runs in its own frame and may keep cookies and local storage there for the check, which we can't read. It's essential, so it loads whatever you choose in the consent banner. The Privacy Policy, section 4, says what it receives."$lw$) = 0 then
    if strpos(s, $lw$"Ahrefs (analytics.ahrefs.com) serves our visit counter, which loads only if you allow analytics. It sets no cookies and keeps nothing in your browser, and it's off for Kids profiles and on pages whose links carry codes. The Privacy Policy, section 4, says what it receives."$lw$) = 0 then
      raise exception 'turnstile policies: on the cookies page, this passage was not found as stored: %', $lw$Ahrefs (analytics.ahrefs.com) serves our visit counter, which loads only if you allow analytics. It sets no cookies and $lw$;
    end if;
    s := replace(s, $lw$"Ahrefs (analytics.ahrefs.com) serves our visit counter, which loads only if you allow analytics. It sets no cookies and keeps nothing in your browser, and it's off for Kids profiles and on pages whose links carry codes. The Privacy Policy, section 4, says what it receives."$lw$, $lw$"Ahrefs (analytics.ahrefs.com) serves our visit counter, which loads only if you allow analytics. It sets no cookies and keeps nothing in your browser, and it's off for Kids profiles and on pages whose links carry codes. The Privacy Policy, section 4, says what it receives.", "Cloudflare Turnstile (challenges.cloudflare.com) is the security check on the log-in, sign-up, password reset and resend-email forms. It runs in its own frame and may keep cookies and local storage there for the check, which we can't read. It's essential, so it loads whatever you choose in the consent banner. The Privacy Policy, section 4, says what it receives."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'cookies'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'turnstile policies: the help page is missing'; end if;
  was := s;
  -- passage 4: after "If Log in or Log in with a passkey does nothing, c…"; never added twice.
  if strpos(s, $lw$"The log-in and sign-up forms show a security check from Cloudflare, which tells people from bots. It usually finishes on its own; now and then it asks you to tick a box. If it says it couldn't load, check that an ad blocker or privacy extension isn't blocking challenges.cloudflare.com, then reload the page."$lw$) = 0 then
    if strpos(s, $lw$"If Log in or Log in with a passkey does nothing, check that your browser isn't letting LiteraryWorm access your local network. LiteraryWorm never needs that permission, and allowing it can stop logging in from working. In Chrome and Edge, select the icon beside the address, choose Site settings, set Local network access to Block, then reload the page and log in again. If your browser asks whether LiteraryWorm can find devices on your local network, choose Block."$lw$) = 0 then
      raise exception 'turnstile policies: on the help page, this passage was not found as stored: %', $lw$If Log in or Log in with a passkey does nothing, check that your browser isn't letting LiteraryWorm access your local ne$lw$;
    end if;
    s := replace(s, $lw$"If Log in or Log in with a passkey does nothing, check that your browser isn't letting LiteraryWorm access your local network. LiteraryWorm never needs that permission, and allowing it can stop logging in from working. In Chrome and Edge, select the icon beside the address, choose Site settings, set Local network access to Block, then reload the page and log in again. If your browser asks whether LiteraryWorm can find devices on your local network, choose Block."$lw$, $lw$"If Log in or Log in with a passkey does nothing, check that your browser isn't letting LiteraryWorm access your local network. LiteraryWorm never needs that permission, and allowing it can stop logging in from working. In Chrome and Edge, select the icon beside the address, choose Site settings, set Local network access to Block, then reload the page and log in again. If your browser asks whether LiteraryWorm can find devices on your local network, choose Block.", "The log-in and sign-up forms show a security check from Cloudflare, which tells people from bots. It usually finishes on its own; now and then it asks you to tick a box. If it says it couldn't load, check that an ad blocker or privacy extension isn't blocking challenges.cloudflare.com, then reload the page."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'help'; end if;
end
$migration$;
