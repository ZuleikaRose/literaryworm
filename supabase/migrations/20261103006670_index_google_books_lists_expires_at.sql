-- The books cache's hourly cleanup finds expired list pages by this (6666). One statement, so it can run outside a transaction.
create index concurrently if not exists google_books_lists_expires_at on public.google_books_lists (expires_at);
