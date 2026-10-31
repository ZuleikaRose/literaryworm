-- The public-domain books' full texts (one JSON file per catalog title, built by
-- front_end/literaryworm_app/scripts/build-texts.py) move out of the site's deploy into a public
-- Storage bucket. The site keeps asking for /texts/<id>.json: Vercel forwards that path here
-- (vercel.json), so the reader, Read offline and the ask and characters functions don't change.
--
-- Public: anyone can read a file by its address, as they could on the site. Nobody writes from
-- the browser (no policies on storage.objects for this bucket); the texts are uploaded with the
-- service role by scripts/upload-texts.sh.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-texts', 'book-texts', true, 8388608, array['application/json'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
