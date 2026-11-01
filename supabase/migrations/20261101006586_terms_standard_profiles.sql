-- Terms: Standard now has 3 profiles, and a household already over a plan's new room keeps its
-- profiles (src/data/legalPages.json has the same). Skipped where an editor has reworded the text.

update public.legal_pages
set sections = replace(replace(sections::text,
      $lw$Standard, 30 hours, 5 profiles and 10 devices$lw$, $lw$Standard, 30 hours, 3 profiles and 10 devices$lw$),
      $lw$first set aside or remove the profiles and free the devices it has no room for.$lw$, $lw$first set aside or remove the profiles and free the devices it has no room for. A household that already has more profiles than its plan now allows, because the plan changed, keeps them in use but can't add more until it fits.$lw$)::jsonb,
    updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$Standard, 30 hours, 5 profiles and 10 devices$lw$) > 0
  and strpos(sections::text, $lw$because the plan changed$lw$) = 0;
