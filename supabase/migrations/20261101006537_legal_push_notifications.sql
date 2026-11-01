-- Notifications on a device (migration 6535): the Privacy Policy, Cookie Policy, Your Privacy
-- Choices and Help say what's kept and who carries them (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$None of them may use your data for their own purposes.$lw$, $lw$None of them may use your data for their own purposes. If you turn on notifications on a device, the notification about a book you set Remind me on (its title and author, and the profile's name) goes through your browser's push service (Google for Chrome and Android, Apple for Safari, Mozilla for Firefox, Microsoft for Edge), encrypted so that only your browser can read it.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$None of them may use your data for their own purposes.$lw$) > 0
  and strpos(sections::text, $lw$your browser's push service$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$so logging in with one of them doesn't ask for the code again.$lw$, $lw$so logging in with one of them doesn't ask for the code again. If you turn on notifications on a device, we keep that browser's push address and keys, a name for the device (like Chrome on Windows) and when it last got a notification, until you turn them off there or log out on it.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$so logging in with one of them doesn't ask for the code again.$lw$) > 0
  and strpos(sections::text, $lw$push address and keys$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$your browser keeps a copy of the app's own files (its pages, code, icons and app manifest). This holds nothing about you.$lw$, $lw$your browser keeps a copy of the app's own files (its pages, code, icons and app manifest). This holds nothing about you. If you turn on notifications in Account → Preferences, your browser also keeps a push subscription for LiteraryWorm; turning them off or logging out removes it.$lw$)::jsonb, updated_at = now()
where slug = $lw$cookies$lw$
  and strpos(sections::text, $lw$your browser keeps a copy of the app's own files (its pages, code, icons and app manifest). This holds nothing about you.$lw$) > 0
  and strpos(sections::text, $lw$keeps a push subscription$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and browser notifications only appear if you allow them.$lw$, $lw$and browser notifications only appear if you allow them. Notifications about books you set Remind me on are turned on and off for each device in Account → Preferences, and logging out on a device turns them off there.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy-choices$lw$
  and strpos(sections::text, $lw$and browser notifications only appear if you allow them.$lw$) > 0
  and strpos(sections::text, $lw$for each device in Account → Preferences$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Account → Plan and billing shows how much you've used this month and which devices hold offline places, and lets you free one.$lw$, $lw$Account → Plan and billing shows how much you've used this month and which devices hold offline places, and lets you free one. To hear when a book you set Remind me on comes out, turn on Notifications on this device in Account → Preferences. On iPhone and iPad, add LiteraryWorm to your Home Screen first (Share, then Add to Home Screen) and turn them on in the app.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$Account → Plan and billing shows how much you've used this month and which devices hold offline places, and lets you free one.$lw$) > 0
  and strpos(sections::text, $lw$turn on Notifications on this device$lw$) = 0;
