import { Link } from "react-router-dom";
import { type BookNotes, downloadText, exportFileName, exportNotes, type ExportFormat } from "../lib/exportNotes";
import { downloadNotesPdf } from "../lib/notesPdf";
import { useNotesBooks } from "../lib/useNotesBooks";
import { HighlightReviewButton } from "./HighlightReview";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";

/** Markdown, Text and PDF buttons that save the notes as a file. */
export function ExportButtons({ books, name, label }: { books: BookNotes[]; name: string; label: string }) {
  const t = useT();
  const save = (format: ExportFormat) => downloadText(exportNotes(books, format), exportFileName(name, format), format);
  return (
    <div className="export-buttons" role="group" aria-label={label}>
      <button type="button" className="secondary-button small-button" onClick={() => save("markdown")}>
        <Icon name="download" size={16} /> Markdown
      </button>
      <button type="button" className="secondary-button small-button" onClick={() => save("text")}>
        <Icon name="download" size={16} /> {t("Text")}
      </button>
      <button
        type="button"
        className="secondary-button small-button"
        onClick={() => downloadNotesPdf(books, exportFileName(name, "text").replace(/\.txt$/, ".pdf"), `${name}: notes and highlights`)}
      >
        <Icon name="download" size={16} /> PDF
      </button>
    </div>
  );
}

/** My Library → Notes: every book with highlights, each with Export, and Export all. */
export function NotesView() {
  const t = useT();
  const books = useNotesBooks();
  const total = books.reduce((n, b) => n + b.highlights.length, 0);
  const entries = books.reduce((n, b) => n + (b.journal?.length ?? 0), 0);

  if (books.length === 0) {
    return (
      <div className="library-empty">
        <h2>{t("No highlights yet")}</h2>
        <p>
          {t("Select words on a page in the reader to highlight them or add a note, or write in My journal on a book's page. They'll all be here, ready to export.")}
        </p>
      </div>
    );
  }

  return (
    <section className="notes-view" aria-labelledby="notes-title">
      <div className="section-head">
        <div>
          <h2 id="notes-title">{t("Notes and highlights")}</h2>
          <p className="muted">
            {entries > 0
              ? t("{highlights} and {entries} in {books}. Exports are made on this device, never uploaded.", {
                  highlights: t.plural(total, { one: "{count} highlight", other: "{count} highlights" }),
                  entries: t.plural(entries, { one: "{count} journal entry", other: "{count} journal entries" }),
                  books: t.plural(books.length, { one: "{count} book", other: "{count} books" }),
                })
              : t("{highlights} in {books}. Exports are made on this device, never uploaded.", {
                  highlights: t.plural(total, { one: "{count} highlight", other: "{count} highlights" }),
                  books: t.plural(books.length, { one: "{count} book", other: "{count} books" }),
                })}
          </p>
        </div>
        <ExportButtons books={books} name="my-literaryworm" label={t("Export all notes and highlights")} />
      </div>
      <HighlightReviewButton />
      <ul className="notes-books" role="list">
        {books.map((b) => {
          const notes = b.highlights.filter((h) => h.note).length;
          return (
            <li key={b.bookId} className="notes-book">
              <div>
                <h3>
                  <Link to={`/read/${b.bookId}`}>{b.title}</Link>
                </h3>
                <p className="muted">
                  {b.author ? `${b.author} · ` : ""}
                  {(b.journal?.length ?? 0) > 0
                    ? t("{highlights}, {notes} with a note, {entries}", {
                        highlights: t.plural(b.highlights.length, { one: "{count} highlight", other: "{count} highlights" }),
                        notes,
                        entries: t.plural(b.journal!.length, { one: "{count} journal entry", other: "{count} journal entries" }),
                      })
                    : t("{highlights}, {notes} with a note", { highlights: t.plural(b.highlights.length, { one: "{count} highlight", other: "{count} highlights" }), notes })}
                </p>
              </div>
              <ExportButtons books={[b]} name={b.title} label={t("Export {title}", { title: b.title })} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
