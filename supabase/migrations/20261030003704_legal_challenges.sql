-- Household challenges (migration 3700): the Privacy Policy's list of what we keep about
-- someone's reading names them (src/data/legalPages.json has the same change). The edit
-- trigger keeps the old version; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$release reminders, recent searches, reading goals,$lw$, $lw$release reminders, recent searches, reading goals, the household challenges your profiles start or join,$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%release reminders, recent searches, reading goals,%$lw$;
