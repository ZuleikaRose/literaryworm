-- Weekly goals for Kids profiles (migration 5000): the Privacy Policy and the Children's Privacy
-- Notice list the goal among what we keep, and the Kids report email's contents
-- (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$each profile's name, avatar, age rating, favourite genres, daily limit and player settings.$lw$, $lw$each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal (Kids profiles) and player settings.$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$each profile's name, avatar, age rating, favourite genres, daily limit and player settings.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$its age rating and any daily reading limit you set, and its reading:$lw$, $lw$its age rating and any daily reading limit and weekly reading goal you set, and its reading:$lw$)::jsonb
where slug in ($lw$childrens-privacy$lw$)
  and strpos(sections::text, $lw$its age rating and any daily reading limit you set, and its reading:$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$(their names, reading and listening time, days read and books finished)$lw$, $lw$(their names, reading and listening time, days read, books finished and any weekly goal)$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$(their names, reading and listening time, days read and books finished)$lw$) > 0;
