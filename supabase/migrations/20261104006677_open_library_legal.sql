-- Open Library is a second book source for adult profiles' Home (books function, _shared/openLibrary.ts): the Privacy
-- Policy names it and what it's sent, the Cookie Policy lists its covers (no cookies), the Terms count it among
-- third-party content, and Help says where Home's rows come from. src/data/legalPages.json has the same. Added once;
-- a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Google API. We use the Google Books API only for book information: our server sends it search words or an ISBN, book ids and the names of authors people follow, never who's asking. Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.\"$lw$, $lw$Google API. We use the Google Books API only for book information: our server sends it search words or an ISBN, book ids and the names of authors people follow, never who's asking. Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.\", \"Open Library. On an adult profile's Home, the genre rows and Keep discovering come from Open Library (openlibrary.org, run by the Internet Archive) when it can answer, and from Google Books when it can't. Our server asks it for a genre's books and a book's details, never who's asking, and keeps its answers for a day. The covers of those books load in your browser from covers.openlibrary.org, which receives your IP address like any website; it sets no cookies.\"$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Google API. We use the Google Books API only for book information: our server sends it search words or an ISBN, book ids and the names of authors people follow, never who's asking. Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.\"$lw$) > 0
  and strpos(sections::text, $lw$Open Library$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$The Internet Archive (archive.org) streams LibriVox recordings and audio clips.$lw$, $lw$The Internet Archive (archive.org) streams LibriVox recordings and audio clips, and its Open Library (covers.openlibrary.org) serves the covers of the Open Library books on an adult profile's Home; Open Library sets no cookies when they load.$lw$)::jsonb, updated_at = now()
where slug = $lw$cookies$lw$
  and strpos(sections::text, $lw$The Internet Archive (archive.org) streams LibriVox recordings and audio clips.$lw$) > 0
  and strpos(sections::text, $lw$Open Library$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$such as book details and covers from Google Books and recordings from LibriVox.$lw$, $lw$such as book details and covers from Google Books and Open Library, and recordings from LibriVox.$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$such as book details and covers from Google Books and recordings from LibriVox.$lw$) > 0
  and strpos(sections::text, $lw$Open Library$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$LiteraryWorm uses the Google Books API to show book details and covers when you browse and search, so you can find almost any book, save it to your library and write about it.\"$lw$, $lw$LiteraryWorm uses the Google Books API to show book details and covers when you browse and search, so you can find almost any book, save it to your library and write about it.\", \"On an adult profile's Home, the genre rows and Keep discovering come from Open Library, a free catalogue run by the Internet Archive, and fall back to Google Books when it has nothing; those books' pages say Details from Open Library. Teen profiles, search and the public home page use Google Books, which leaves out titles it marks as mature.\"$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$LiteraryWorm uses the Google Books API to show book details and covers when you browse and search, so you can find almost any book, save it to your library and write about it.\"$lw$) > 0
  and strpos(sections::text, $lw$Open Library$lw$) = 0;
