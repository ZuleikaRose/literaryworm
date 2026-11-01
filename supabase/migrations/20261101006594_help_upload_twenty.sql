-- Help (Can I read my own books?): up to 20 EPUBs at a time, each up to 50 MB, up to 50 a profile.
-- src/data/legalPages.json has the same. Skipped where an editor has reworded it.

update public.legal_pages
set sections = replace(sections::text, $lw$Yes. In My Library → Uploads, add an EPUB you own that has no DRM.$lw$, $lw$Yes. In My Library → Uploads, add EPUBs you own that have no DRM: up to 20 at a time, each up to 50 MB (a profile keeps up to 50).$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$ and strpos(sections::text, $lw$Yes. In My Library → Uploads, add an EPUB you own that has no DRM.$lw$) > 0;
