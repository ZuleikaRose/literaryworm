-- Index for the foreign key on legal_pages (updated_by).
create index concurrently if not exists legal_pages_updated_by_idx on public.legal_pages (updated_by);
