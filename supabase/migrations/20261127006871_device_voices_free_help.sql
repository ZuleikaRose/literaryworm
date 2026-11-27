-- Help: device voices are free on every plan and never use natural-voice hours (each plan's natural-voice hours
-- are unchanged: Basic 2, Standard 6, Premium 12, with more bought as packs). Same text as src/data/legalPages.json.
-- Loud like the other policy migrations; run again, it changes nothing.

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'device voices help: the help page is missing'; end if;
  was := s;
  if strpos(s, $lw$"Your device's own voices are free on every plan: they read any book aloud as much as you like and never use natural-voice hours."$lw$) = 0 then
    if strpos(s, $lw$"Each month your plan includes new natural-voice reading (Basic 2 hours, Standard 6, Premium 12); Account → This month shows what's left, and the bell tells you when most of it is used. Parts you've played stay on your device to listen offline, and on Wi-Fi the next chapter is voiced ahead. Listening counts towards your plan's audiobook hours as usual."$lw$) = 0 then
      raise exception 'device voices help: on the help page, this passage was not found as stored: %', $lw$Each month your plan includes new natural-voice reading (Basic 2 hours, Standard 6, Premium 12); Account → This month sh$lw$;
    end if;
    s := replace(s, $lw$"Each month your plan includes new natural-voice reading (Basic 2 hours, Standard 6, Premium 12); Account → This month shows what's left, and the bell tells you when most of it is used. Parts you've played stay on your device to listen offline, and on Wi-Fi the next chapter is voiced ahead. Listening counts towards your plan's audiobook hours as usual."$lw$, $lw$"Each month your plan includes new natural-voice reading (Basic 2 hours, Standard 6, Premium 12); Account → This month shows what's left, and the bell tells you when most of it is used. Parts you've played stay on your device to listen offline, and on Wi-Fi the next chapter is voiced ahead. Listening counts towards your plan's audiobook hours as usual.", "Your device's own voices are free on every plan: they read any book aloud as much as you like and never use natural-voice hours."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'help'; end if;
end
$migration$;
