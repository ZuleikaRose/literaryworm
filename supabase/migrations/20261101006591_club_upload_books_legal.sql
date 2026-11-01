-- Book clubs on uploaded books (migration 6589): the Privacy Policy, Copyright and Terms say a club
-- started around an upload shows its members only the title and author, each member reads their own
-- copy and nobody's upload is shared; Help gets "Book clubs on your own books". src/data/legalPages.json
-- has the same. Each is changed once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$and books you upload (private to the profile that added them; we keep their text only).$lw$, $lw$and books you upload (private to the profile that added them; we keep their text only; if you start a book club around one, the club's members see its title and author, never its text).$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$ and strpos(sections::text, $lw$and books you upload (private to the profile that added them; we keep their text only).$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Books members upload are private to their own profile and aren't shown to anyone else;$lw$, $lw$Books members upload are private to their own profile and aren't shown to anyone else (a book club started around one shows only its title and author);$lw$)::jsonb, updated_at = now()
where slug = $lw$copyright$lw$ and strpos(sections::text, $lw$Books members upload are private to their own profile and aren't shown to anyone else;$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Your uploads stay private to the profile that added them. We store their text only to show it to you, claim no rights in them, and delete them when you do or when you delete the profile or account."$lw$, $lw$Your uploads stay private to the profile that added them. We store their text only to show it to you, claim no rights in them, and delete them when you do or when you delete the profile or account.", "You can start a book club around a book you uploaded. Its members see only the title and author; each of them reads their own copy, which they must also have the right to read, and nobody's upload is shared with anyone else."$lw$)::jsonb, updated_at = now()
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$Your uploads stay private to the profile that added them. We store their text only to show it to you, claim no rights in them, and delete them when you do or when you delete the profile or account.$lw$) > 0
  and strpos(sections::text, $lw$start a book club around a book you uploaded$lw$) = 0;

-- Before the last section (Report a problem).
update public.legal_pages
set sections = jsonb_insert(sections, '{-1}', $lw${"heading": "Book clubs on your own books", "paragraphs": ["A club can read a LiteraryWorm title or a book you uploaded, such as a DRM-free EPUB you bought. When you start a club in My Library → Clubs, choose My uploads under Book from and search by title or author to find it.", "Uploads stay private, so members don't get your file. The club shows the book's title and author, and each member uploads their own copy and chooses it on the club's page (Choose your copy). Posts, where everyone is and shared highlights then follow each member's place in their own copy, so nothing past their chapter is spoiled. An uploaded book has no recording, so there's no listening along."]}$lw$::jsonb), updated_at = now()
where slug = $lw$help$lw$
  and jsonb_typeof(sections) = 'array'
  and jsonb_array_length(sections) > 0
  and strpos(sections::text, $lw$Book clubs on your own books$lw$) = 0;
