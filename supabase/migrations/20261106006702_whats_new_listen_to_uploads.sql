-- What's new: listening to uploads (a device voice, or the catalog's LibriVox recording of the same book).
-- src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-06'::date, '2026.11', 'feature', $lw$Listen to the books you upload$lw$, $lw$Your uploaded EPUBs can now be listened to as well as read: choose Listen in My Library → Uploads or on the book's page, and one of your device's voices reads it in the player, with your place, speed, sleep timer and bookmarks. When LiteraryWorm has the same public-domain book with a LibriVox recording, your upload offers that too, read by a person: choose Listen to their recording. The demo's uploads include the opening of Frankenstein to show it.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Listen to the books you upload$lw$ and c.version = '2026.11');
