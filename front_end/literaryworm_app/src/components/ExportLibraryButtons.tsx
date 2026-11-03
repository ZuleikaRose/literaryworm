import { useState } from "react";
import { getBook } from "../data/books";
import { downloadCsv, type ExportBook, exportCsvName, type ExportFormat, lastFinished, toCsv } from "../lib/exportLibraryCsv";
import { today } from "../lib/reading";
import { finishDays } from "../lib/rereads";
import { useProfileData, useStore } from "../store/context";
import { activeLibrary } from "../store/reducer";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";

/**
 * *Export for Goodreads* and *Export for StoryGraph* in My Library (lib/exportLibraryCsv.ts):
 * the library as that site's CSV, with statuses, ratings as stars, when each was added and
 * finished. Made on this device and downloaded, never uploaded.
 */
export function ExportLibraryButtons() {
  const t = useT();
  const { state } = useStore();
  const library = activeLibrary(state);
  const data = useProfileData();
  const [status, setStatus] = useState("");
  const entries = Object.values(library);
  if (entries.length === 0) return null;

  function save(format: ExportFormat) {
    const finished = lastFinished(data.readingDays);
    const books: ExportBook[] = entries
      .sort((a, b) => a.addedAt - b.addedAt)
      .map((e) => {
        const book = getBook(e.bookId);
        const upload = data.uploads.find((u) => u.id === e.bookId);
        const published = e.published ? Number(e.published.slice(0, 4)) : null;
        return {
          bookId: e.bookId,
          title: book?.title ?? upload?.title ?? e.title ?? "Untitled book",
          authors: book ? [book.author] : upload?.author ? [upload.author] : (e.authors ?? []),
          status: e.status,
          addedAt: e.addedAt,
          // The day it was finished here, else when its status last changed.
          finishedOn: finished[e.bookId] ?? (e.status === "finished" && e.updatedAt ? today(new Date(e.updatedAt)) : null),
          readDays: finishDays(data.readingDays, e.bookId),
          pages: book?.pages ?? null,
          year: book?.year ?? (published && Number.isFinite(published) ? published : null),
          rating: data.ratings[e.bookId] ?? null,
          mood: data.moods[e.bookId] ?? null,
        };
      });
    downloadCsv(toCsv(books, format), exportCsvName(format, today()));
    setStatus(
      t.plural(books.length, { one: "Saved {count} book as a {site} file.", other: "Saved {count} books as a {site} file." }, { site: format === "goodreads" ? "Goodreads" : "StoryGraph" }),
    );
  }

  return (
    <>
      <button type="button" className="secondary-button small-button" onClick={() => save("goodreads")}>
        <Icon name="share" size={16} /> {t("Export for Goodreads")}
      </button>
      <button type="button" className="secondary-button small-button" onClick={() => save("storygraph")}>
        <Icon name="share" size={16} /> {t("Export for StoryGraph")}
      </button>
      <p className="visually-hidden" role="status">
        {status}
      </p>
    </>
  );
}
