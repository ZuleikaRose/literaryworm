-- Family listening report: the Privacy Policy says what's counted; Help explains it. Same text as src/data/legalPages.json, matched as stored; made once.

update public.legal_pages
set sections = replace(sections::text, $lw$"Pronunciations: respellings of names you add for an upload (how a name sounds) are kept with your profile's player settings, and sent to Google Cloud Text-to-Speech in place of those names in the parts that have them."$lw$, $lw$"Pronunciations: respellings of names you add for an upload (how a name sounds) are kept with your profile's player settings, and sent to Google Cloud Text-to-Speech in place of those names in the parts that have them.", "For the family report in Account → Family, we also count how much new natural-voice reading each profile had voiced a month (a number of characters, never the text), kept a year and seen only by your account."$lw$)::jsonb
where slug = 'privacy'
  and strpos(sections::text, $lw$For the family report in Account → Family, we also count how much new natural-voice reading each profile had voiced a month (a number of characters, never the text), kept a year and seen only by your account.$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$"On a Kids profile, My Library → Badges has Certificates to print: one for each badge earned and for reading 7, 14, 30, 100 or 365 days in a row, with the child's name and the day. Each is a one-page PDF made on the device and downloaded, never uploaded."$lw$, $lw$"On a Kids profile, My Library → Badges has Certificates to print: one for each badge earned and for reading 7, 14, 30, 100 or 365 days in a row, with the child's name and the day. Each is a one-page PDF made on the device and downloaded, never uploaded.", "Account → Family has This month's listening: each profile's audiobook listening and new natural-voice reading this month, so you can see where the plan's hours go."$lw$)::jsonb
where slug = 'help'
  and strpos(sections::text, $lw$Account → Family has This month's listening: each profile's audiobook listening and new natural-voice reading this month, so you can see where the plan's hours go.$lw$) = 0;
