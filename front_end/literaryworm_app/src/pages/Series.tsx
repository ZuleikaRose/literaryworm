import { Link, useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { Cover } from "../components/Cover";
import { personPath } from "../lib/people";
import { seriesBooks, seriesNamed } from "../lib/series";
import { useTitle } from "../lib/useTitle";
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
  useTitle(`${name} (series)`);
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
    if (p) return `${Math.round(p.fraction * 100)}% through`;
    if (library.entries[b.id]?.status === "want_to_read") return "On your reading list";
    return null;
  };
  const nextUp = profile ? titles.find((b) => status(b) !== "Finished") : undefined;
  const anyFinished = profile ? titles.some((b) => status(b) === "Finished") : false;

  return (
    <div className="page-content series-page">
      <BackLink />
      <header className="series-hero">
        <p className="eyebrow">Series</p>
        <h1>{name}</h1>
        <p className="person-count">
          {titles.length} {titles.length === 1 ? "book" : "books"} on LiteraryWorm, in reading order
          {authors.length > 0 && (
            <>
              {" · by "}
              {authors.map((a, i) => (
                <span key={a}>
                  {i > 0 && ", "}
                  <Link to={personPath("author", a)}>{a}</Link>
                </span>
              ))}
            </>
          )}
        </p>
        {nextUp && anyFinished && (
          <p className="series-next">
            Next for you: <Link to={`/books/${nextUp.id}`}>{nextUp.title}</Link>
          </p>
        )}
      </header>
      {titles.length === 0 ? (
        <p className="person-empty">None of this series is on LiteraryWorm for this profile yet.</p>
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
                    {s ? ` · ${s}` : ""}
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
