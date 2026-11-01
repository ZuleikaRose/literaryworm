-- What's new: the rewritten Children's Privacy Notice (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$A clearer Children's Privacy Notice$lw$, $lw$We rewrote the Children's Privacy Notice for parents and guardians. It now starts with a short summary, groups what a Kids profile keeps, lists what we never collect, explains the AI features a Kids profile can use (only the book's own text reaches Anthropic), says who can see a child's reading and for how long it's kept, and how to withdraw consent or ask us a question.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A clearer Children's Privacy Notice$lw$ and c.version = $lw$2026.11$lw$);
