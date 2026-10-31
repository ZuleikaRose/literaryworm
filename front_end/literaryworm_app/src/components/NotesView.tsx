import { Link } from "react-router-dom";
import { type BookNotes, downloadText, exportFileName, exportNotes, type ExportFormat } from "../lib/exportNotes";
import { useNotesBooks } from "../lib/useNotesBooks";
import { Icon } from "./Icon";

/** Markdown and Text buttons that save the notes as a file. */
export function ExportButtons({ books, name, label }: { books: BookNotes[]; name: string; label: string }) {
  const save = (format: ExportFormat) => downloadText(exportNotes(books, format), exportFileName(name, format), format);
  return (
    <div className="export-buttons" role="group" aria-label={label}>
      <button type="button" className="secondary-button small-button" onClick={() => save("markdown")}>
        <Icon name="download" size={16} /> Markdown
      </button>
      <button type="button" className="secondary-button small-button" onClick={() => save("text")}>
        <Icon name="download" size={16} /> Text
      </button>
    </div>
  );
}

/** My Library → Notes: every book with highlights, each with Export, and Export all. */
export function NotesView() {
  const books = useNotesBooks();
  const total = books.reduce((n, b) => n + b.highlights.length, 0);

  if (books.length === 0) {
    return (
      <div className="library-empty">
        <h2>No highlights yet</h2>
        <p>Select words on a page in the reader to highlight them or add a note. They'll all be here, ready to export.</p>
      </div>
    );
  }

  return (
    <section className="notes-view" aria-labelledby="notes-title">
      <div className="section-head">
        <div>
          <h2 id="notes-title">Notes and highlights</h2>
          <p className="muted">
            {total} highlight{total === 1 ? "" : "s"} in {books.length} book{books.length === 1 ? "" : "s"}. Exports are made on this device, never uploaded.
          </p>
        </div>
        <ExportButtons books={books} name="my-literaryworm" label="Export all notes and highlights" />
      </div>
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
                  {b.highlights.length} highlight{b.highlights.length === 1 ? "" : "s"}, {notes} with a note
                </p>
              </div>
              <ExportButtons books={[b]} name={b.title} label={`Export ${b.title}`} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
