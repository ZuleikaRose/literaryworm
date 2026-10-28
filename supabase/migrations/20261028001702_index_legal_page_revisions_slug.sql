-- Index for the foreign key on legal_page_revisions (slug).
create index concurrently if not exists legal_page_revisions_slug_idx on public.legal_page_revisions (slug, replaced_at);
