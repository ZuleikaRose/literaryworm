-- My words in the book's own language: the reader's dictionary now looks a word up in the
-- language of the book it was met in (the `dictionary` function's `lang`, Wiktionary's entries
-- for that language, explained in English), so a kept word carries its language, and the same
-- spelling can be kept once per language ("gift" in English and in German).
--
-- English words keep their old rule (lower case, letters with an inner apostrophe or hyphen);
-- other languages' words are any letters (German nouns keep their capital, Greek, Cyrillic,
-- Arabic, Devanagari, Chinese, Japanese and Korean too), with no spaces or control characters,
-- at most 40 characters. Rows already kept are English. RLS, the owner policies, the two-step
-- policy and the 500-word limit are unchanged; the browser may insert the new column.

alter table public.saved_words
  add column language text not null default 'en'
    check (language in ('en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'ja', 'zh', 'ko', 'hi', 'ar', 'pl', 'ru', 'tr', 'sv', 'uk', 'tl', 'bg', 'ro', 'el'));

alter table public.saved_words drop constraint saved_words_word_check;
alter table public.saved_words
  add constraint saved_words_word_check check (
    char_length(word) between 1 and 40
    and word = btrim(word)
    and word !~ '[[:space:][:cntrl:]]'
    and word !~ '^[''-]|[''-]$'
    and (language <> 'en' or word ~ '^[a-z]+([''-][a-z]+)*$')
  );

-- The key includes the language. It still leads with (profile_id, user_id), so it still indexes
-- the foreign key to reader_profiles.
alter table public.saved_words drop constraint saved_words_pkey;
alter table public.saved_words add primary key (profile_id, user_id, language, word);

grant insert (language) on public.saved_words to authenticated;
