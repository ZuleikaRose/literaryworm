import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { ReaderFollowButton } from "../components/ReaderFollowButton";
import { ReaderLogList } from "../components/ReaderLogList";
import { initials } from "../lib/bookDetail";
import { fetchReader, fetchReaderLogs, LogsApiError } from "../lib/logsApi";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";
import type { ReadingLog } from "../types";
import NotFound from "./NotFound";

type Load = { status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "done"; name: string; logs: ReadingLog[] };

/** A reader's page (/readers/:id): their public logs, for members who turned their page on. */
export default function ReaderProfile() {
  const id = useParams().id ?? "";
  return <ReaderPage key={id} id={id} />;
}

function ReaderPage({ id }: { id: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const signedIn = Boolean(useStore().state.account);
  useTitle(load.status === "done" ? `${load.name} (reader)` : "Reader");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const reader = await fetchReader(id);
        if (!reader) {
          if (live) setLoad({ status: "missing" });
          return;
        }
        const logs = await fetchReaderLogs([reader.id]);
        if (live) setLoad({ status: "done", name: reader.name, logs });
      } catch (err) {
        if (live) setLoad({ status: "error", message: err instanceof LogsApiError ? err.message : "Something went wrong. Try again." });
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);

  if (load.status === "missing") return <NotFound />;

  return (
    <div className="page-content person-page">
      <BackLink />
      {load.status === "loading" && <p role="status">Loading this reader…</p>}
      {load.status === "error" && (
        <p className="form-alert" role="alert">
          {load.message}
        </p>
      )}
      {load.status === "done" && (
        <>
          <header className="person-hero">
            <span className="person-mark" aria-hidden="true">
              {initials(load.name)}
            </span>
            <div className="person-heading">
              <p className="eyebrow">Reader</p>
              <h1>{load.name}</h1>
              <p className="person-count">
                {load.logs.length === 0 ? "No logs yet" : `${load.logs.length === 30 ? "Their latest 30 logs" : `${load.logs.length} ${load.logs.length === 1 ? "log" : "logs"}`}`}
              </p>
            </div>
            {signedIn ? (
              <ReaderFollowButton readerId={id} name={load.name} />
            ) : (
              <Link className="secondary-button" to="/signin">
                Log in to follow
              </Link>
            )}
          </header>
          {load.logs.length === 0 ? (
            <p className="person-empty">When {load.name} writes a log about a book, it shows up here.</p>
          ) : (
            <ReaderLogList logs={load.logs} />
          )}
        </>
      )}
    </div>
  );
}
