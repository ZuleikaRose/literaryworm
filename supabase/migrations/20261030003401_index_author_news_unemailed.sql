-- claim_author_emails() looks for rows not emailed yet, by account. Its own migration:
-- CREATE INDEX CONCURRENTLY can't run inside a transaction.
create index concurrently if not exists author_news_unemailed on public.author_news (user_id, found_at) where emailed_at is null;
