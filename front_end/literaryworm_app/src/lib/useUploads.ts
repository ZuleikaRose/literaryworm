import { activeLibrary } from "../store/reducer";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { UploadedBook } from "../types";
import { countWords, readEpub } from "./epub";
import { newUploadId, tabTexts } from "./uploads";
import { deleteUpload, saveUpload } from "./uploadsApi";
import { useLibrary } from "./useLibrary";

/**
 * The active profile's uploaded books. Adding one reads the EPUB in the browser; members save
 * its text to Storage and list it in Supabase first, then the store; in-memory accounts keep
 * it in this tab. Each call rejects with an Error whose message can be shown.
 */
export function useUploads() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const { uploads } = useProfileData();
  const library = useLibrary();
  const remote = Boolean(state.account?.userId);

  async function add(file: File): Promise<UploadedBook> {
    if (!profile) throw new Error("Choose a profile first.");
    if (profile.ageRating === "kids") throw new Error("Kids profiles can't upload books.");
    const parsed = await readEpub(file);
    const texts = parsed.chapters.map((c) => c.text);
    const chapterWords = texts.map(countWords);
    const book = {
      id: newUploadId(),
      title: parsed.title,
      author: parsed.author,
      chapterTitles: parsed.chapters.map((c) => c.title),
      chapterWords,
      words: chapterWords.reduce((a, b) => a + b, 0),
    };
    const upload = remote ? await saveUpload(profile.id, book, texts) : { ...book, path: null, createdAt: Date.now() };
    if (!remote) tabTexts.set(upload.id, texts);
    dispatch({ type: "addUpload", upload });
    return upload;
  }

  /** Deletes the book, and takes it out of the library (with its place, bookmarks and highlights). */
  async function remove(upload: UploadedBook): Promise<void> {
    if (activeLibrary(state)[upload.id]) await library.remove(upload.id);
    if (remote) await deleteUpload(upload);
    else tabTexts.delete(upload.id);
    dispatch({ type: "removeUpload", id: upload.id });
  }

  return { uploads, add, remove, canUpload: Boolean(profile && profile.ageRating !== "kids") };
}
