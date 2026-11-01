/** Whether a book's chapter can have a "Previously…" recap: a public-domain title (it has a recording) past its first chapter. */
export const canRecap = (book: { recording?: unknown }, chapterIndex: number) => Boolean(book.recording) && chapterIndex >= 1;
