-- What's new: The Metamorphosis no longer offers its LibriVox recording (another translation). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'update', $lw$The Metamorphosis is read by our voices$lw$, $lw$The Metamorphosis is now read aloud by a natural voice or a voice from your device, from the translation you read on the page. Its LibriVox recording reads a different translation, so we no longer offer it, and the voice and the text now say the same words.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$The Metamorphosis is read by our voices$lw$ and c.released_on = '2026-11-28');
