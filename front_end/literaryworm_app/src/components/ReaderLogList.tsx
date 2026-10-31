import { Link } from "react-router-dom";
import { getBook } from "../data/books";
import type { ReadingLog } from "../types";
import { LogCard } from "./LogCard";

/** Logs from several books: each under its book's title. */
export function ReaderLogList({ logs }: { logs: ReadingLog[] }) {
  return (
    <ul className="reader-log-list" role="list">
      {logs.map((log) => (
        <li key={log.id}>
          <p className="reader-log-book">
            On <Link to={`/books/${log.bookId}`}>{getBook(log.bookId)?.title ?? "a book from Google Books"}</Link>
          </p>
          <LogCard log={log} />
        </li>
      ))}
    </ul>
  );
}
