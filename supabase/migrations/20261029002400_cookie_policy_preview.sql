-- The Google Books preview (an embedded viewer on some book pages, loaded only
-- when the reader opens it) is a new third party the browser reaches: the
-- Cookie Policy says so (src/data/legalPages.json has the same change). The
-- edit trigger keeps the old version; a page an editor has reworded since is
-- left as it is.
update public.legal_pages
set sections = replace(sections::text,
      'Some book covers from Google Books, and the audiobook recordings streamed from the Internet Archive, load from those services.',
      'Some book covers from Google Books, the Google Books preview on some book pages (only when you open it), and the audiobook recordings streamed from the Internet Archive, load from those services.')::jsonb
where slug = 'cookies'
  and sections::text like '%Some book covers from Google Books, and the audiobook recordings streamed from the Internet Archive, load from those services.%';
