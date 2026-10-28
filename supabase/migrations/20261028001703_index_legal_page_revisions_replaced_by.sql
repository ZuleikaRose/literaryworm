-- Index for the foreign key on legal_page_revisions (replaced_by).
create index concurrently if not exists legal_page_revisions_replaced_by_idx on public.legal_page_revisions (replaced_by);
