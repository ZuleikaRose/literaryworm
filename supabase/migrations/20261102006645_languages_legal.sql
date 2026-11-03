-- The app in seven languages: the Accessibility Policy and Help say where to choose one and what stays in English
-- (the policies and Help among them). src/data/legalPages.json has the same. Added once; a page an editor has reworded
-- is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$ contrast, underlined links and reduced motion. Your choices last for the visit."$lw$, $lw$ contrast, underlined links and reduced motion. Your choices last for the visit.", "Language in the accessibility menu shows the app in English, Spanish, French, German, Portuguese, Italian or Dutch; a visit starts in your browser's language when it's one of these. Book details, What's new and our emails stay in English for now, and so do these policies and Help, where the English version is the one that applies."$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$ contrast, underlined links and reduced motion. Your choices last for the visit."$lw$) > 0
  and strpos(sections::text, $lw$Language in the accessibility menu shows$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$ile you browse, and its controls also work from your lock screen and headphones."$lw$, $lw$ile you browse, and its controls also work from your lock screen and headphones.", "Choose Language in the accessibility menu (the figure at the top of every page) to see the app in English, Spanish, French, German, Portuguese, Italian or Dutch. Parts still being translated show in English, and the policies and Help stay in English."$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$ile you browse, and its controls also work from your lock screen and headphones."$lw$) > 0
  and strpos(sections::text, $lw$Choose Language in the accessibility menu$lw$) = 0;
