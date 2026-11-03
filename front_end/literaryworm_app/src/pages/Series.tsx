import { Link, useParams } from "react-router-dom";
import { absoluteUrl, HOME_CRUMB, pageData, seriesData } from "../lib/seo";
import { StructuredData } from "../components/StructuredData";
import { BackLink } from "../components/BackLink";
import { Cover } from "../components/Cover";
import { personPath } from "../lib/people";
import { seriesBooks, seriesNamed, seriesPath } from "../lib/series";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { rich } from "../lib/i18n";
import { useLibrary } from "../lib/useLibrary";
import { useActiveProfile, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { Book } from "../types";
import NotFound from "./NotFound";

/** A series page (/series/:name): its books in reading order, with where this profile is. */
export default function Series() {
  const series = seriesNamed(useParams().name);
  if (!series) return <NotFound />;
  return <SeriesPage key={series.name} name={series.name} ids={series.ids} />;
}

function SeriesPage({ name, ids }: { name: string; ids: string[] }) {
  const t = useT();
  useTitle(t("{name} (series)", { name }));
  const profile = useActiveProfile();
  const ageRating = profile?.ageRating ?? "all";
  const titles = seriesBooks({ name, ids }, ageRating);
  const authors = [...new Set(titles.map((b) => b.author))];
  const { state } = useStore();
  const library = useLibrary();
  const progress = activeReading(state).progress;

  const status = (b: Book): string | null => {
    if (!profile) return null;
    const p = progress[b.id];
    if (p?.finished || library.entries[b.id]?.status === "finished") return "Finished";
    if (p) return "through";
    if (library.entries[b.id]?.status === "want_to_read") return "On your reading list";
    return null;
  };
  const statusLabel = (b: Book, s: string) =>
    s === "Finished"
      ? t("Finished")
      : s === "through"
        ? t("{percent}% through", { percent: Math.round(progress[b.id]!.fraction * 100) })
        : t("On your reading list");
  const nextUp = profile ? titles.find((b) => status(b) !== "Finished") : undefined;
  const anyFinished = profile ? titles.some((b) => status(b) === "Finished") : false;

  return (
    <div className="page-content series-page">
      <StructuredData
        id="page"
        data={pageData({
          type: "CollectionPage",
          path: seriesPath(name),
          name: `${name} (series)`,
          crumbs: [HOME_CRUMB, { name, path: seriesPath(name) }],
          mainEntity: { "@id": `${absoluteUrl(seriesPath(name))}#series` },
        })}
      />
      <StructuredData id="series" data={seriesData(name, seriesPath(name), titles)} />
      <BackLink />
      <header className="series-hero">
        <p className="eyebrow">{t("Series")}</p>
        <h1>{name}</h1>
        <p className="person-count">
          {t.plural(titles.length, { one: "{count} book on LiteraryWorm, in reading order", other: "{count} books on LiteraryWorm, in reading order" })}
          {authors.length > 0 &&
            rich(t(" · by {authors}"), {
              authors: authors.map((a, i) => (
                <span key={a}>
                  {i > 0 && ", "}
                  <Link to={personPath("author", a)}>{a}</Link>
                </span>
              )),
            })}
        </p>
        {nextUp && anyFinished && (
          <p className="series-next">
            {rich(t("Next for you: {book}"), { book: <Link to={`/books/${nextUp.id}`}>{nextUp.title}</Link> })}
          </p>
        )}
      </header>
      {titles.length === 0 ? (
        <p className="person-empty">{t("None of this series is on LiteraryWorm for this profile yet.")}</p>
      ) : (
        <ol className="series-list">
          {titles.map((b, i) => {
            const s = status(b);
            return (
              <li key={b.id} className={`series-item${b.id === nextUp?.id && anyFinished ? " is-next" : ""}`}>
                <span className="series-number" aria-hidden="true">
                  {i + 1}
                </span>
                <Link to={`/books/${b.id}`} className="series-cover" tabIndex={-1} aria-hidden="true">
                  <Cover book={b} size="sm" />
                </Link>
                <div className="series-text">
                  <h2>
                    <Link to={`/books/${b.id}`}>{b.title}</Link>
                  </h2>
                  <p className="muted">
                    {b.author} · {b.year}
                    {s ? ` · ${statusLabel(b, s)}` : ""}
                  </p>
                  <p className="series-synopsis">{b.synopsis}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
