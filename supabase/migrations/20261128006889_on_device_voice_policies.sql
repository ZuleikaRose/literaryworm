-- On-device voices (6888): the Privacy Policy, the Cookie Policy and Help each gain a paragraph,
-- after the one named. Same text as src/data/legalPages.json. One update per page; a page whose
-- anchor paragraph isn't there as stored stops the migration. Run again, it changes nothing.

do $migration$
declare
  s text;
begin
  select sections::text into s from public.legal_pages where slug = 'privacy' for update;
  if s is null then raise exception 'on-device voice policies: the privacy page is missing'; end if;
  if strpos(s, $lw$"Reading aloud with a voice on your device: for books in English, members can choose Linda (a woman's voice) or Norman (a man's), natural voices that run in your own browser. The voice, about 64 MB, downloads once from our own storage (Supabase) and is kept in your browser. The text it reads never leaves your device, and nothing about your listening is sent to us or anyone else, so Kids profiles can use them too."$lw$) > 0 then return; end if;
  if strpos(s, $lw$"Reading aloud with a natural voice: members can choose a natural voice from Google for a book they uploaded or a public-domain classic (on a Kids profile only once a grown-up turns them on for it in Account → Family, with the account password). Our server sends Google Cloud Text-to-Speech the text being voiced, a part at a time as you listen (or every part, one after another, when you choose Voice the whole book), and keeps the audio in private storage: an upload's with your upload, deleted with the upload, its profile or your account; a classic's once for everyone, since it holds only the book's own words. We count how much is voiced each month, for your plan's allowance."$lw$) = 0 then
    raise exception 'on-device voice policies: on the privacy page, the paragraph to follow was not found as stored';
  end if;
  s := replace(s, $lw$"Reading aloud with a natural voice: members can choose a natural voice from Google for a book they uploaded or a public-domain classic (on a Kids profile only once a grown-up turns them on for it in Account → Family, with the account password). Our server sends Google Cloud Text-to-Speech the text being voiced, a part at a time as you listen (or every part, one after another, when you choose Voice the whole book), and keeps the audio in private storage: an upload's with your upload, deleted with the upload, its profile or your account; a classic's once for everyone, since it holds only the book's own words. We count how much is voiced each month, for your plan's allowance."$lw$, $lw$"Reading aloud with a natural voice: members can choose a natural voice from Google for a book they uploaded or a public-domain classic (on a Kids profile only once a grown-up turns them on for it in Account → Family, with the account password). Our server sends Google Cloud Text-to-Speech the text being voiced, a part at a time as you listen (or every part, one after another, when you choose Voice the whole book), and keeps the audio in private storage: an upload's with your upload, deleted with the upload, its profile or your account; a classic's once for everyone, since it holds only the book's own words. We count how much is voiced each month, for your plan's allowance.", "Reading aloud with a voice on your device: for books in English, members can choose Linda (a woman's voice) or Norman (a man's), natural voices that run in your own browser. The voice, about 64 MB, downloads once from our own storage (Supabase) and is kept in your browser. The text it reads never leaves your device, and nothing about your listening is sent to us or anyone else, so Kids profiles can use them too."$lw$);
  update public.legal_pages set sections = s::jsonb where slug = 'privacy';
end
$migration$;

do $migration$
declare
  s text;
begin
  select sections::text into s from public.legal_pages where slug = 'cookies' for update;
  if s is null then raise exception 'on-device voice policies: the cookies page is missing'; end if;
  if strpos(s, $lw$"On-device voices you've chosen (the lw-voices cache): about 64 MB each, kept until you choose Remove the on-device voices from this device under the player's Voice menu, or clear this site's data in your browser."$lw$) > 0 then return; end if;
  if strpos(s, $lw$"Books you uploaded and opened, or searched by keywords, and the natural-voice parts of them you've played or that were voiced ahead on Wi-Fi (the lw-uploads cache): stay until you delete the book or log out."$lw$) = 0 then
    raise exception 'on-device voice policies: on the cookies page, the paragraph to follow was not found as stored';
  end if;
  s := replace(s, $lw$"Books you uploaded and opened, or searched by keywords, and the natural-voice parts of them you've played or that were voiced ahead on Wi-Fi (the lw-uploads cache): stay until you delete the book or log out."$lw$, $lw$"Books you uploaded and opened, or searched by keywords, and the natural-voice parts of them you've played or that were voiced ahead on Wi-Fi (the lw-uploads cache): stay until you delete the book or log out.", "On-device voices you've chosen (the lw-voices cache): about 64 MB each, kept until you choose Remove the on-device voices from this device under the player's Voice menu, or clear this site's data in your browser."$lw$);
  update public.legal_pages set sections = s::jsonb where slug = 'cookies';
end
$migration$;

do $migration$
declare
  s text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'on-device voice policies: the help page is missing'; end if;
  if strpos(s, $lw$"Members can also choose Linda (a woman's voice) or Norman (a man's), American English natural voices that run on your own device, for any book in English. The first time, the voice downloads (about 64 MB); after that it starts within a few seconds and works offline. It's free, doesn't count towards your month's natural-voice reading, and the text never leaves your device. Remove the on-device voices from this device, under the Voice menu, frees the space."$lw$) > 0 then return; end if;
  if strpos(s, $lw$"The public-domain classics have natural voices too. For members they come first in the Voice menu and read the classic's own full text; the LibriVox recording is still there to choose. A part another member has already heard in that voice plays straight away and doesn't count towards your month; a new one does. In the demo, classics keep their LibriVox recording."$lw$) = 0 then
    raise exception 'on-device voice policies: on the help page, the paragraph to follow was not found as stored';
  end if;
  s := replace(s, $lw$"The public-domain classics have natural voices too. For members they come first in the Voice menu and read the classic's own full text; the LibriVox recording is still there to choose. A part another member has already heard in that voice plays straight away and doesn't count towards your month; a new one does. In the demo, classics keep their LibriVox recording."$lw$, $lw$"The public-domain classics have natural voices too. For members they come first in the Voice menu and read the classic's own full text; the LibriVox recording is still there to choose. A part another member has already heard in that voice plays straight away and doesn't count towards your month; a new one does. In the demo, classics keep their LibriVox recording.", "Members can also choose Linda (a woman's voice) or Norman (a man's), American English natural voices that run on your own device, for any book in English. The first time, the voice downloads (about 64 MB); after that it starts within a few seconds and works offline. It's free, doesn't count towards your month's natural-voice reading, and the text never leaves your device. Remove the on-device voices from this device, under the Voice menu, frees the space."$lw$);
  update public.legal_pages set sections = s::jsonb where slug = 'help';
end
$migration$;
