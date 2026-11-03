import { Link } from "react-router-dom";
import { getBook } from "../data/books";
import type { ReadingLog } from "../types";
import { LogCard } from "./LogCard";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";

/** Logs from several books: each under its book's title. */
export function ReaderLogList({ logs }: { logs: ReadingLog[] }) {
  const t = useT();
  return (
    <ul className="reader-log-list" role="list">
      {logs.map((log) => (
        <li key={log.id}>
          <p className="reader-log-book">
            {rich(t("On {book}"), { book: <Link to={`/books/${log.bookId}`}>{getBook(log.bookId)?.title ?? t("a book from Google Books")}</Link> })}
          </p>
          <LogCard log={log} />
        </li>
      ))}
    </ul>
  );
}
