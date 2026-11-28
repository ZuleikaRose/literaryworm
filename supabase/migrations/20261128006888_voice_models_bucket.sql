-- On-device natural voices (front_end/literaryworm_app/src/lib/onDeviceVoice.ts): the Piper voice
-- models (ONNX, about 64 MB each) and their configs, in a public Storage bucket. The site asks for
-- /voice-models/<file>; Vercel forwards that here (vercel.json), and the browser keeps the file in
-- its own cache, so each device downloads a voice once.
--
-- Public: anyone can read a file by its address. Nobody writes from the browser (no policies on
-- storage.objects for this bucket); the models are uploaded with supabase/upload-voice-models.sh.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-models', 'voice-models', true, 134217728, array['application/octet-stream', 'application/json'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
