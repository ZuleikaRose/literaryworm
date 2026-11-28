-- Connected apps that may change the library (6885): the Privacy Policy, the Children's Privacy Notice
-- and Help. Same text as src/data/legalPages.json.
--
-- One update per page (one revision row each), and loud: a passage that's neither in its old wording nor
-- already in its new one stops the migration with the page named. Run again, it changes nothing.

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'privacy' for update;
  if s is null then raise exception 'library scope policies: the privacy page is missing'; end if;
  was := s;
  if strpos(s, $lw$"Apps you connect. If you choose to connect an AI assistant or the LiteraryWorm command line to your account, we give that app, when it asks, your library and how far through each book you are, your highlights and their notes, and reading time for grown-up and teen profiles. It only reads, unless, when you connect it, you also let it add books from our catalog to your library and change a book's status (such as marking it finished); it can never remove a book. It's never given your password, your payment details, your email address, or a Kids profile's name or reading time, and books a Kids profile has spent time reading are left out. We share this only because you ask us to, confirmed with your account password, and you can stop it at any time in Account → Sign-in. What the app and its maker do with what they read is governed by their own privacy policy, not this one."$lw$) = 0 then
    if strpos(s, $lw$"Apps you connect. If you choose to connect an AI assistant or the LiteraryWorm command line to your account, we give that app, when it asks, your library and how far through each book you are, your highlights and their notes, and reading time for grown-up and teen profiles. It can only read. It's never given your password, your payment details, your email address, or a Kids profile's name or reading time, and books a Kids profile has spent time reading are left out. We share this only because you ask us to, confirmed with your account password, and you can stop it at any time in Account → Sign-in. What the app and its maker do with what they read is governed by their own privacy policy, not this one."$lw$) = 0 then
      raise exception 'library scope policies: on the privacy page, passage 1 was not found as stored';
    end if;
    s := replace(s, $lw$"Apps you connect. If you choose to connect an AI assistant or the LiteraryWorm command line to your account, we give that app, when it asks, your library and how far through each book you are, your highlights and their notes, and reading time for grown-up and teen profiles. It can only read. It's never given your password, your payment details, your email address, or a Kids profile's name or reading time, and books a Kids profile has spent time reading are left out. We share this only because you ask us to, confirmed with your account password, and you can stop it at any time in Account → Sign-in. What the app and its maker do with what they read is governed by their own privacy policy, not this one."$lw$, $lw$"Apps you connect. If you choose to connect an AI assistant or the LiteraryWorm command line to your account, we give that app, when it asks, your library and how far through each book you are, your highlights and their notes, and reading time for grown-up and teen profiles. It only reads, unless, when you connect it, you also let it add books from our catalog to your library and change a book's status (such as marking it finished); it can never remove a book. It's never given your password, your payment details, your email address, or a Kids profile's name or reading time, and books a Kids profile has spent time reading are left out. We share this only because you ask us to, confirmed with your account password, and you can stop it at any time in Account → Sign-in. What the app and its maker do with what they read is governed by their own privacy policy, not this one."$lw$);
  end if;
  if strpos(s, $lw$"If you connect an app (an AI assistant, or the LiteraryWorm command line) to read your account, we keep the name the app gave itself, the address it sends you back to, when you connected it and when it was last used, whether you let it change your library, and one-way hashes of the tokens we gave it, never the tokens themselves. Removing the app in Account → Sign-in, or deleting your account, deletes them. A request to connect that isn't finished is deleted within about an hour, and a connection that goes unused for 90 days ends."$lw$) = 0 then
    if strpos(s, $lw$"If you connect an app (an AI assistant, or the LiteraryWorm command line) to read your account, we keep the name the app gave itself, the address it sends you back to, when you connected it and when it was last used, and one-way hashes of the tokens we gave it, never the tokens themselves. Removing the app in Account → Sign-in, or deleting your account, deletes them. A request to connect that isn't finished is deleted within about an hour, and a connection that goes unused for 90 days ends."$lw$) = 0 then
      raise exception 'library scope policies: on the privacy page, passage 2 was not found as stored';
    end if;
    s := replace(s, $lw$"If you connect an app (an AI assistant, or the LiteraryWorm command line) to read your account, we keep the name the app gave itself, the address it sends you back to, when you connected it and when it was last used, and one-way hashes of the tokens we gave it, never the tokens themselves. Removing the app in Account → Sign-in, or deleting your account, deletes them. A request to connect that isn't finished is deleted within about an hour, and a connection that goes unused for 90 days ends."$lw$, $lw$"If you connect an app (an AI assistant, or the LiteraryWorm command line) to read your account, we keep the name the app gave itself, the address it sends you back to, when you connected it and when it was last used, whether you let it change your library, and one-way hashes of the tokens we gave it, never the tokens themselves. Removing the app in Account → Sign-in, or deleting your account, deletes them. A request to connect that isn't finished is deleted within about an hour, and a connection that goes unused for 90 days ends."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'privacy'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'childrens-privacy' for update;
  if s is null then raise exception 'library scope policies: the childrens-privacy page is missing'; end if;
  was := s;
  if strpos(s, $lw$"If you connect an app to your account (an AI assistant or the LiteraryWorm command line, in Account → Sign-in), it can read your household's shared library, places and highlights, and, if you let it, add books to the shared library or change a book's status. It never changes a book a Kids profile has spent time reading. It is never given a Kids profile's name, reading time, journal, quiz scores or book requests, and books a Kids profile has spent time reading or listening to are left out. A book a child only opened for under a minute can still appear in the shared library, without saying who opened it. Connecting an app is always your choice, needs your account password, and can be undone at any time."$lw$) = 0 then
    if strpos(s, $lw$"If you connect an app to your account (an AI assistant or the LiteraryWorm command line, in Account → Sign-in), it can read your household's shared library, places and highlights. It is never given a Kids profile's name, reading time, journal, quiz scores or book requests, and books a Kids profile has spent time reading or listening to are left out. A book a child only opened for under a minute can still appear in the shared library, without saying who opened it. Connecting an app is always your choice, needs your account password, and can be undone at any time."$lw$) = 0 then
      raise exception 'library scope policies: on the childrens-privacy page, passage 1 was not found as stored';
    end if;
    s := replace(s, $lw$"If you connect an app to your account (an AI assistant or the LiteraryWorm command line, in Account → Sign-in), it can read your household's shared library, places and highlights. It is never given a Kids profile's name, reading time, journal, quiz scores or book requests, and books a Kids profile has spent time reading or listening to are left out. A book a child only opened for under a minute can still appear in the shared library, without saying who opened it. Connecting an app is always your choice, needs your account password, and can be undone at any time."$lw$, $lw$"If you connect an app to your account (an AI assistant or the LiteraryWorm command line, in Account → Sign-in), it can read your household's shared library, places and highlights, and, if you let it, add books to the shared library or change a book's status. It never changes a book a Kids profile has spent time reading. It is never given a Kids profile's name, reading time, journal, quiz scores or book requests, and books a Kids profile has spent time reading or listening to are left out. A book a child only opened for under a minute can still appear in the shared library, without saying who opened it. Connecting an app is always your choice, needs your account password, and can be undone at any time."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'childrens-privacy'; end if;
end
$migration$;

do $migration$
declare
  s text;
  was text;
begin
  select sections::text into s from public.legal_pages where slug = 'help' for update;
  if s is null then raise exception 'library scope policies: the help page is missing'; end if;
  was := s;
  if strpos(s, $lw$"A connected app reads your library and how far through each book you are, your highlights and their notes, and reading time for grown-up and teen profiles. If the app asks, and you leave that ticked when you allow it, it can also add books from our catalog to your library and change a book's status; it can never remove a book. It never sees your password, your payment details, the text of your uploads, or a Kids profile's name or reading time. Books a Kids profile has spent time reading are left out of what it reads."$lw$) = 0 then
    if strpos(s, $lw$"A connected app can only read: your library and how far through each book you are, your highlights and their notes, and reading time for grown-up and teen profiles. It can't change anything, and it never sees your password, your payment details, the text of your uploads, or a Kids profile's name or reading time. Books a Kids profile has spent time reading are left out of what it reads."$lw$) = 0 then
      raise exception 'library scope policies: on the help page, passage 1 was not found as stored';
    end if;
    s := replace(s, $lw$"A connected app can only read: your library and how far through each book you are, your highlights and their notes, and reading time for grown-up and teen profiles. It can't change anything, and it never sees your password, your payment details, the text of your uploads, or a Kids profile's name or reading time. Books a Kids profile has spent time reading are left out of what it reads."$lw$, $lw$"A connected app reads your library and how far through each book you are, your highlights and their notes, and reading time for grown-up and teen profiles. If the app asks, and you leave that ticked when you allow it, it can also add books from our catalog to your library and change a book's status; it can never remove a book. It never sees your password, your payment details, the text of your uploads, or a Kids profile's name or reading time. Books a Kids profile has spent time reading are left out of what it reads."$lw$);
  end if;
  if s <> was then update public.legal_pages set sections = s::jsonb where slug = 'help'; end if;
end
$migration$;
