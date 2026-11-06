-- Uploads can be listened to: Help says how (Listen, a device voice, and a catalog title's LibriVox recording
-- where there is one), and that Listen together isn't offered for an upload; the Privacy Policy says that voices
-- marked (online) are the browser maker's, which get the text being read. Same text as src/data/legalPages.json,
-- matched as stored (the closing quote of the paragraph before, unescaped). Added once; a page an editor has
-- reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Your upload opens in the reader with your place, bookmarks and highlights, and once you've opened it on a device, it keeps working there if your connection drops. Books with DRM can't be uploaded, and removing DRM to upload a book isn't allowed (see the Terms of Service)."$lw$, $lw$Your upload opens in the reader with your place, bookmarks and highlights, and once you've opened it on a device, it keeps working there if your connection drops. Books with DRM can't be uploaded, and removing DRM to upload a book isn't allowed (see the Terms of Service).", "Choose Listen on an upload to hear it read aloud by one of your device's voices, in the same player as any audiobook, with its speed, sleep timer and bookmarks. When LiteraryWorm has the same public-domain book with a LibriVox recording, read by a person, your upload offers that too: choose Listen to their recording. The recording keeps its own place, apart from your upload's."$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$Your upload opens in the reader with your place, bookmarks and highlights, and once you've opened it on a device, it keeps working there if your connection drops. Books with DRM can't be uploaded, and removing DRM to upload a book isn't allowed (see the Terms of Service)."$lw$) > 0
  and strpos(sections::text, $lw$Choose Listen on an upload$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$An uploaded book has no recording, so there's no listening along.$lw$, $lw$Listen together isn't offered for an uploaded book, because each member listens to their own copy.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$An uploaded book has no recording, so there's no listening along.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Voice control in car mode: off until you turn it on, and not offered to Kids profiles. While car mode is open and on screen, your browser listens through the microphone and its own speech service turns what you say into words (Google's in Chrome and Edge, Apple's in Safari), under that company's terms. The app only reads the words for a command: we never get the sound, and we keep nothing."$lw$, $lw$Voice control in car mode: off until you turn it on, and not offered to Kids profiles. While car mode is open and on screen, your browser listens through the microphone and its own speech service turns what you say into words (Google's in Chrome and Edge, Apple's in Safari), under that company's terms. The app only reads the words for a command: we never get the sound, and we keep nothing.", "Reading aloud with a device voice: the player can read a book, including one you uploaded, with a voice your browser offers. Voices marked (online) are your browser maker's online voices (Microsoft's in Edge, Google's in Chrome): to speak, your browser sends them the text being read, under that company's terms. Other voices run on your device. We send nothing ourselves."$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Voice control in car mode: off until you turn it on, and not offered to Kids profiles. While car mode is open and on screen, your browser listens through the microphone and its own speech service turns what you say into words (Google's in Chrome and Edge, Apple's in Safari), under that company's terms. The app only reads the words for a command: we never get the sound, and we keep nothing."$lw$) > 0
  and strpos(sections::text, $lw$Reading aloud with a device voice$lw$) = 0;
