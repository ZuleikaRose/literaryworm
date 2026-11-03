-- The app's language follows the profile (6647): the Privacy Policy lists it among what's kept for each profile,
-- and the Accessibility Policy and Help say members' profiles keep it on every device. src/data/legalPages.json has
-- the same. Added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$player settings, and whether it's set aside.$lw$, $lw$player settings, the app language it chose, and whether it's set aside.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$player settings, and whether it's set aside.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$a visit starts in your browser's language when it's one of these. Book details$lw$, $lw$a visit starts in your browser's language when it's one of these, and a member's profile keeps the language it chooses on every device. Book details$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$a visit starts in your browser's language when it's one of these. Book details$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Parts still being translated show in English, and the policies and Help stay in English.$lw$, $lw$Your profile keeps the language you choose, so it opens the same way on your other devices. Book details, What's new and our emails, the policies and Help stay in English.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$Parts still being translated show in English, and the policies and Help stay in English.$lw$) > 0;
