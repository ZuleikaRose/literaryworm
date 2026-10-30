-- Bigger Standard and Premium plans (migration 5800): the Terms' plan limits list the new profile and
-- device numbers (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Each plan includes the audiobook listening and offline devices shown on the Plans page:$lw$, $lw$Each plan includes the audiobook listening, profiles and offline devices shown on the Plans page:$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$Each plan includes the audiobook listening and offline devices shown on the Plans page:$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Basic, 5 hours a month and 1 device; Standard, 30 hours and 3 devices; Premium, unlimited listening and 5 devices.$lw$, $lw$Basic, 5 hours a month, 1 profile and 1 device; Standard, 30 hours, 5 profiles and 10 devices; Premium, unlimited listening, 12 profiles and 24 devices.$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$Basic, 5 hours a month and 1 device; Standard, 30 hours and 3 devices; Premium, unlimited listening and 5 devices.$lw$) > 0;
