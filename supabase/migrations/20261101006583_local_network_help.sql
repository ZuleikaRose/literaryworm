-- Local network access: never allow it for LiteraryWorm (it can stop logging in from working).
-- Help gets a "Trouble logging in?" section; the Privacy and Cookie Policies a sentence each
-- (src/data/legalPages.json has the same). Each is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$and you can free one.$lw$, $lw$and you can free one. LiteraryWorm never asks for access to your local network (the other devices on your home Wi-Fi) and doesn't need it for anything, including Listen on another device and playing on a speaker or TV. If your browser asks, choose Block.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$and you can free one.$lw$) > 0
  and strpos(sections::text, $lw$access to your local network$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Safari, Edge and Opera.$lw$, $lw$Safari, Edge and Opera. Your browser may also ask whether LiteraryWorm can reach devices on your local network. Choose Block: the app never needs it, and allowing it can stop logging in from working in that browser. If you allowed it, turn it off in the site's settings (in Chrome and Edge, select the icon beside the address, then Site settings, and set Local network access to Block).$lw$)::jsonb, updated_at = now()
where slug = $lw$cookies$lw$
  and strpos(sections::text, $lw$Safari, Edge and Opera.$lw$) > 0
  and strpos(sections::text, $lw$devices on your local network$lw$) = 0;

-- Before the last section (Report a problem).
update public.legal_pages
set sections = jsonb_insert(sections, '{-1}', $lw${"heading": "Trouble logging in?", "paragraphs": ["If Log in or Log in with a passkey does nothing, check that your browser isn't letting LiteraryWorm access your local network. LiteraryWorm never needs that permission, and allowing it can stop logging in from working. In Chrome and Edge, select the icon beside the address, choose Site settings, set Local network access to Block, then reload the page and log in again. If your browser asks whether LiteraryWorm can find devices on your local network, choose Block.", "Still stuck? Try a private or incognito window. If that works, a browser extension or something saved in your usual window is in the way. Otherwise, email support@literaryworm.com with your device and browser."]}$lw$::jsonb), updated_at = now()
where slug = $lw$help$lw$
  and jsonb_typeof(sections) = 'array'
  and jsonb_array_length(sections) > 0
  and strpos(sections::text, $lw$Trouble logging in?$lw$) = 0;
