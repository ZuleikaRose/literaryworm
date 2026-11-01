-- OpenDyslexic, reading ruler and line focus: the Accessibility Policy and Help (src/data/legalPages.json has the same).
-- Each sentence is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$In the reader you can choose the font, size, spacing, margins and theme.$lw$, $lw$In the reader you can choose the font, size, spacing, margins and theme. Fonts include Lexend and OpenDyslexic, a typeface made for readers with dyslexia, and a reading guide can show a ruler on one line or dim everything but a few lines (line focus); it follows your pointer or a tap, and J and K move it a line.$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$In the reader you can choose the font, size, spacing, margins and theme.$lw$) > 0
  and strpos(sections::text, $lw$OpenDyslexic$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$made on your device, to import there.$lw$, $lw$made on your device, to import there. In the reader, Display has OpenDyslexic among the fonts, and Reading guide: a reading ruler on one line, or line focus, which dims everything but three lines. It follows your pointer or a tap; J and K move it down or up a line.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$made on your device, to import there.$lw$) > 0
  and strpos(sections::text, $lw$Reading guide: a reading ruler$lw$) = 0;
