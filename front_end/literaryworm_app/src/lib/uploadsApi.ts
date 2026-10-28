import type { UploadedBook } from "../types";
import { AccountError, signedInUserId } from "./accountApi";
import { supabase } from "./supabase";

/**
 * Members' uploaded books: uploaded_books (the list, RLS to the account) and the private
 * user-books bucket (each book's text as JSON, in the account's own folder). Every message
 * here is shown to people as is.
 */

const BUCKET = "user-books";

function client() {
  if (!supabase) throw new AccountError("Uploading books needs the LiteraryWorm backend, which isn't set up in this copy of the app.");
  return supabase;
}

type Row = {
  id: string;
  profile_id: string;
  title: string;
  author: string;
  chapter_titles: string[];
  chapter_words: number[];
  words: number;
  storage_path: string;
  created_at: string;
};

const toUpload = (row: Row): UploadedBook => ({
  id: row.id,
  title: row.title,
  author: row.author,
  chapterTitles: row.chapter_titles,
  chapterWords: row.chapter_words,
  words: row.words,
  path: row.storage_path,
  createdAt: Date.parse(row.created_at),
});

/** Every profile's uploads, newest first. If they can't load, the account still opens without them. */
export async function loadUploads(): Promise<{ profileId: string; book: UploadedBook }[]> {
  const { data, error } = await client()
    .from("uploaded_books")
    .select("id, profile_id, title, author, chapter_titles, chapter_words, words, storage_path, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("uploads: couldn't load", error.message);
    return [];
  }
  return (data as Row[]).map((row) => ({ profileId: row.profile_id, book: toUpload(row) }));
}

/** Saves an uploaded book's text, then lists it for the profile. Removes the text again if listing fails. */
export async function saveUpload(profileId: string, book: Omit<UploadedBook, "path" | "createdAt">, chapters: string[]): Promise<UploadedBook> {
  const db = client();
  const userId = await signedInUserId();
  const path = `${userId}/${book.id}.json`;
  const file = new Blob([JSON.stringify({ chapters })], { type: "application/json" });
  const stored = await db.storage.from(BUCKET).upload(path, file, { contentType: "application/json", upsert: false });
  if (stored.error) {
    if (/size|large/i.test(stored.error.message)) throw new AccountError("This book's text is over 15 MB, more than LiteraryWorm keeps for one book.");
    throw new AccountError("We couldn't upload the book. Try again.");
  }
  const { data, error } = await db
    .from("uploaded_books")
    .insert({
      id: book.id,
      profile_id: profileId,
      user_id: userId,
      title: book.title,
      author: book.author,
      chapter_titles: book.chapterTitles,
      chapter_words: book.chapterWords,
      words: book.words,
      storage_path: path,
    })
    .select("id, profile_id, title, author, chapter_titles, chapter_words, words, storage_path, created_at")
    .single();
  if (error) {
    // Don't leave a file nobody can see.
    const removed = await db.storage.from(BUCKET).remove([path]);
    if (removed.error) console.error("uploads: couldn't remove an unlisted file", removed.error.message);
    if (error.message.includes("50 uploaded")) throw new AccountError("A profile can have up to 50 uploaded books. Delete one to add another.");
    if (error.message.includes("Kids")) throw new AccountError("Kids profiles can't upload books.");
    throw new AccountError("We couldn't upload the book. Try again.");
  }
  return toUpload(data as Row);
}

/** An uploaded book's chapters. */
export async function loadUploadText(path: string): Promise<string[]> {
  const { data, error } = await client().storage.from(BUCKET).download(path);
  if (error || !data) throw new AccountError("We couldn't load this book's text. Check your connection and try again.");
  const chapters = (JSON.parse(await data.text()) as { chapters?: unknown }).chapters;
  if (!Array.isArray(chapters) || !chapters.every((c) => typeof c === "string")) throw new AccountError("This book's text is damaged. Delete it and upload it again.");
  return chapters as string[];
}

/** Deletes an uploaded book: its listing, then its text. */
export async function deleteUpload(book: UploadedBook): Promise<void> {
  const db = client();
  const { error } = await db.from("uploaded_books").delete().eq("id", book.id);
  if (error) throw new AccountError("We couldn't delete the book. Try again.");
  if (book.path) {
    const removed = await db.storage.from(BUCKET).remove([book.path]);
    // Already unlisted, so nothing shows it; the file is only wasted space.
    if (removed.error) console.error("uploads: couldn't remove the book's file", removed.error.message);
  }
}
