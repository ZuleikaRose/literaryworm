import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchReaderLogs, LogsApiError } from "../lib/logsApi";
import { useReaderFollows } from "../lib/useReaderFollows";
import type { ReadingLog } from "../types";
import { Icon } from "./Icon";
import { ReaderFollowButton } from "./ReaderFollowButton";
import { ReaderLogList } from "./ReaderLogList";

/** My Library → Readers: the readers this profile follows, and their newest logs. */
export function ReadersView() {
  const readers = useReaderFollows();
  const ids = readers.follows.map((f) => f.readerId).join(",");
  const [logs, setLogs] = useState<ReadingLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ids) return;
    let live = true;
    fetchReaderLogs(ids.split(",")).then(
      (found) => live && setLogs(found),
      (err) => live && setError(err instanceof LogsApiError ? err.message : "Something went wrong. Try again."),
    );
    return () => {
      live = false;
    };
  }, [ids]);

  if (!readers.available) {
    return (
      <div className="library-empty">
        <h2>Following readers is for members</h2>
        <p>Members can follow other readers who share their logs, and see what they're reading here. Kids profiles don't follow readers.</p>
      </div>
    );
  }
  if (readers.follows.length === 0) {
    return (
      <div className="library-empty">
        <h2>You don't follow any readers yet</h2>
        <p>On a book's page, a reader's name is a link when they share their logs. Open it and choose Follow to see their new logs here.</p>
        <p className="muted">To let others follow you, turn on Let other readers follow me in Account → Preferences.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="readers-title">
      <div className="section-head">
        <div>
          <h2 id="readers-title">Readers you follow</h2>
          <p className="muted">Only you see who you follow.</p>
        </div>
      </div>
      <ul className="author-list" role="list">
        {readers.follows.map((f) => (
          <li key={f.readerId}>
            <div className="author-text">
              <Link to={`/readers/${f.readerId}`}>{f.name}</Link>
            </div>
            <ReaderFollowButton readerId={f.readerId} name={f.name} />
          </li>
        ))}
      </ul>
      <h2 className="readers-feed-title">Their newest logs</h2>
      {error && (
        <p className="form-alert" role="alert">
          <Icon name="alert" size={17} /> <span>{error}</span>
        </p>
      )}
      {!error && logs === null && <p role="status">Loading their logs…</p>}
      {logs && logs.length === 0 && <p className="muted">Nothing new from them yet.</p>}
      {logs && logs.length > 0 && <ReaderLogList logs={logs} />}
    </section>
  );
}
