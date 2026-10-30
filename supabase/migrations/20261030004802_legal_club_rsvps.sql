-- Club meeting RSVPs (migration 4800): the Privacy Policy says members' answers are seen by the
-- club (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Things you share or add: reading logs (public, with your display name), book club posts (seen by the club's members),$lw$, $lw$Things you share or add: reading logs (public, with your display name), book club posts and whether you're coming to a club's meetings (seen by the club's members),$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Things you share or add: reading logs (public, with your display name), book club posts (seen by the club's members),$lw$) > 0;
