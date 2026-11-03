import { useEffect, useState } from "react";
import { HOME_CRUMB, pageData, personNode } from "../lib/seo";
import { StructuredData } from "../components/StructuredData";
import { Link, useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { ReaderFollowButton } from "../components/ReaderFollowButton";
import { ReaderLogList } from "../components/ReaderLogList";
import { initials } from "../lib/bookDetail";
import { fetchReader, fetchReaderLogs, LogsApiError } from "../lib/logsApi";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { useStore } from "../store/context";
import type { ReadingLog } from "../types";
import NotFound from "./NotFound";

type Load = { status: "loading" } | { status: "missing" } | { status: "error"; message: string | null } | { status: "done"; name: string; logs: ReadingLog[] };

/** A reader's page (/readers/:id): their public logs, for members who turned their page on. */
export default function ReaderProfile() {
  const id = useParams().id ?? "";
  return <ReaderPage key={id} id={id} />;
}

function ReaderPage({ id }: { id: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const signedIn = Boolean(useStore().state.account);
  const t = useT();
  useTitle(load.status === "done" ? t("{name} (reader)", { name: load.name }) : t("Reader"));

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
        if (live) setLoad({ status: "error", message: err instanceof LogsApiError ? err.message : null });
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);

  if (load.status === "missing") return <NotFound />;

  return (
    <div className="page-content person-page">
      {load.status === "done" && (
        <StructuredData
          id="page"
          data={pageData({
            type: "ProfilePage",
            path: `/readers/${encodeURIComponent(id)}`,
            name: `${load.name} (reader)`,
            crumbs: [HOME_CRUMB, { name: load.name, path: `/readers/${encodeURIComponent(id)}` }],
            mainEntity: personNode(load.name, `/readers/${encodeURIComponent(id)}`),
          })}
        />
      )}
      <BackLink />
      {load.status === "loading" && <p role="status">{t("Loading this reader…")}</p>}
      {load.status === "error" && (
        <p className="form-alert" role="alert">
          {load.message ?? t("Something went wrong. Try again.")}
        </p>
      )}
      {load.status === "done" && (
        <>
          <header className="person-hero">
            <span className="person-mark" aria-hidden="true">
              {initials(load.name)}
            </span>
            <div className="person-heading">
              <p className="eyebrow">{t("Reader")}</p>
              <h1>{load.name}</h1>
              <p className="person-count">
                {load.logs.length === 0
                  ? t("No logs yet")
                  : load.logs.length === 30
                    ? t("Their latest 30 logs")
                    : t.plural(load.logs.length, { one: "{count} log", other: "{count} logs" })}
              </p>
            </div>
            {signedIn ? (
              <ReaderFollowButton readerId={id} name={load.name} />
            ) : (
              <Link className="secondary-button" to="/signin">
                {t("Log in to follow")}
              </Link>
            )}
          </header>
          {load.logs.length === 0 ? (
            <p className="person-empty">{t("When {name} writes a log about a book, it shows up here.", { name: load.name })}</p>
          ) : (
            <ReaderLogList logs={load.logs} />
          )}
        </>
      )}
    </div>
  );
}
