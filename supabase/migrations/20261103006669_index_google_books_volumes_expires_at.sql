-- The books cache's hourly cleanup finds expired volumes by this (6666). One statement, so it can run outside a transaction.
create index concurrently if not exists google_books_volumes_expires_at on public.google_books_volumes (expires_at);
