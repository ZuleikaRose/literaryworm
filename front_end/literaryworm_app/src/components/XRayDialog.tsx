import { type CSSProperties, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DEMO_XRAY, DEMO_XRAY_BOOKS } from "../data/demoXRay";
import { usesBackend } from "../lib/backend";
import { tk, tr } from "../lib/i18n";
import { bookText } from "../lib/narration";
import { type ReaderPage, textPages } from "../lib/reading";
import { useT } from "../lib/useT";
import { kindsFor, localNames, mentionIndex, mentionStops, type XRayItem, type XRayKind, xrayMode, type XRayMode, type XRayRow, xrayRows, type XRayScope } from "../lib/xray";
import { fetchXRay, XRayError } from "../lib/xrayApi";
import { useActiveProfile, useStore } from "../store/context";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/** Above this many entries, a box to find one by name. */
const FILTER_FROM = 8;
/** Chapters (or pages) with mentions listed before Show all. */
const STOPS_SHOWN = 12;

const KIND_LABELS: Record<XRayKind, string> = { people: tk("Who's who"), places: tk("Places"), terms: tk("Terms"), names: tk("Names") };

/**
 * The reader's X-Ray: the people, places and terms met so far, up to the chapter open now, with
 * how often and where the text names them (this chapter or the book so far), and a way to jump
 * to each mention. Descriptions are labelled as written by AI (or as the demo's sample); names
 * found on this device have none. Nothing first met later is listed. `pages` are the reader's;
 * without them (the player) the book's text is loaded here and mentions link to the reader.
 */
export function XRayDialog({
  open,
  book,
  chapterIndex,
  pages = null,
  onGo,
  onClose,
}: {
  open: boolean;
  book: Book;
  chapterIndex: number;
  pages?: ReaderPage[] | null;
  /** Goes to a page of the reader (its index in `pages`); without it, mentions open the reader there. */
  onGo?: (index: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("X-Ray")} eyebrow={book.title}>
      {open && <XRay key={`${book.id}:${chapterIndex}`} book={book} chapterIndex={chapterIndex} givenPages={pages} onGo={onGo} />}
    </Dialog>
  );
}

/** The reader's pages, or the book's text made into pages here (the player). */
function usePages(book: Book, givenPages: ReaderPage[] | null, wanted: boolean): { pages: ReaderPage[] | null; failed: boolean } {
  const [loaded, setLoaded] = useState<{ pages: ReaderPage[] | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (givenPages || !wanted) return;
    let live = true;
    bookText(book).then(
      (chapters) => live && setLoaded({ pages: textPages(chapters), failed: false }),
      () => live && setLoaded({ pages: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [book, givenPages, wanted]);
  if (givenPages) return { pages: givenPages, failed: false };
  return loaded ?? { pages: null, failed: false };
}

function XRay({ book, chapterIndex, givenPages, onGo }: { book: Book; chapterIndex: number; givenPages: ReaderPage[] | null; onGo?: (index: number) => void }) {
  const t = useT();
  const { state } = useStore();
  const profile = useActiveProfile();
  const chosen = xrayMode({ book, profile, backend: usesBackend, demo: Boolean(state.account?.isDemo), demoBooks: DEMO_XRAY_BOOKS });
  // After the AI X-Ray fails, the reader can choose names found on this device instead.
  const [fallback, setFallback] = useState(false);
  const mode: XRayMode = fallback && chosen === "ai" ? "local" : chosen;
  const { pages, failed } = usePages(book, givenPages, mode !== "none");

  const [aiItems, setAiItems] = useState<XRayItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (mode !== "ai") return;
    let live = true;
    fetchXRay(book.id, chapterIndex).then(
      (found) => {
        if (!live) return;
        setAiItems(found);
        setError(null);
      },
      (err) => live && setError(err instanceof XRayError ? err.message : tr("Something went wrong. Try again.")),
    );
    return () => {
      live = false;
    };
  }, [mode, book.id, chapterIndex, tries]);

  const items = useMemo<XRayItem[] | null>(() => {
    if (mode === "demo") return DEMO_XRAY[book.id] ?? [];
    if (mode === "local") return pages ? localNames(pages, chapterIndex) : null;
    if (mode === "ai") return aiItems;
    return [];
  }, [mode, book.id, pages, chapterIndex, aiItems]);

  if (mode === "none") {
    return (
      <div className="xray">
        <p className="goal-hint">
          <Icon name="alert" size={15} /> {t("X-Ray looks through a book's own text. We only have sample pages for this book, so there's nothing to look through.")}
        </p>
      </div>
    );
  }

  const hint =
    mode === "ai"
      ? t("Written by AI from the book up to chapter {chapter}. Nothing you haven't reached is listed or given away. Mentions are counted in the book's own text.", { chapter: chapterIndex + 1 })
      : mode === "demo"
        ? t("A sample X-Ray for the demo, written ahead of time. Only what you've met by chapter {chapter} is listed, and mentions are counted in the book's own text.", { chapter: chapterIndex + 1 })
        : t("Names that recur in the book up to chapter {chapter}, found on this device: no AI, and the book's text stays here. Mentions are counted in the text itself.", { chapter: chapterIndex + 1 });

  return (
    <div className="xray">
      <p className="goal-hint">
        <Icon name={mode === "local" ? "search" : "ask"} size={15} /> {hint}
      </p>
      {error && mode === "ai" ? (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <div>
            <p>{error}</p>
            <div className="xray-actions">
              <button
                type="button"
                className="secondary-button small-button"
                onClick={() => {
                  setError(null);
                  setTries((n) => n + 1);
                }}
              >
                {t("Try again")}
              </button>
              <button type="button" className="text-button" onClick={() => setFallback(true)}>
                {t("Use names found on this device instead")}
              </button>
            </div>
          </div>
        </div>
      ) : failed ? (
        <p className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <span>{t("We couldn't load this book's text. Try again.")}</span>
        </p>
      ) : !pages || !items ? (
        <p role="status" aria-busy="true">
          {mode === "ai" && pages
            ? t("Gathering the X-Ray up to chapter {chapter}… The first time for a chapter can take a few seconds.", { chapter: chapterIndex + 1 })
            : t("Loading the book's text…")}
        </p>
      ) : (
        <XRayLists book={book} items={items} pages={pages} chapterIndex={chapterIndex} onGo={onGo} />
      )}
    </div>
  );
}

function XRayLists({
  book,
  items,
  pages,
  chapterIndex,
  onGo,
}: {
  book: Book;
  items: XRayItem[];
  pages: ReaderPage[];
  chapterIndex: number;
  onGo?: (index: number) => void;
}) {
  const t = useT();
  const id = useId();
  const kinds = kindsFor(items);
  const [kind, setKind] = useState<XRayKind | null>(null);
  const shownKind = kind && kinds.includes(kind) ? kind : (kinds[0] ?? null);
  const [scope, setScope] = useState<XRayScope>("sofar");
  const [filter, setFilter] = useState("");
  // One pass over the text so far for every entry (lib/xray.ts mentionIndex()), redone only when
  // the entries or the chapter change; the scope reuses it, and a tab only filters the rows.
  const index = useMemo(() => mentionIndex(items, pages, chapterIndex), [items, pages, chapterIndex]);
  const allRows = useMemo(() => xrayRows(items, pages, chapterIndex, scope, index), [items, pages, chapterIndex, scope, index]);
  const rows = allRows.filter((r) => r.kind === shownKind);
  const wanted = filter.trim().toLowerCase();
  const shown = rows.filter((r) => !wanted || [r.name, ...r.aliases].some((n) => n.toLowerCase().includes(wanted)));

  if (items.length === 0) return <p className="goal-hint">{t("We couldn't pick out any names up to chapter {chapter}.", { chapter: chapterIndex + 1 })}</p>;

  return (
    <>
      {kinds.length > 1 && (
        <div className="xray-kinds" role="group" aria-label={t("X-Ray")}>
          {kinds.map((k) => (
            <button key={k} type="button" className="secondary-button small-button" aria-pressed={k === shownKind} onClick={() => setKind(k)}>
              {t(KIND_LABELS[k])}
            </button>
          ))}
        </div>
      )}
      <fieldset className="segmented xray-scope">
        <legend className="field-label">{t("Mentions in")}</legend>
        <div>
          {(["chapter", "sofar"] as const).map((s) => (
            <label key={s}>
              <input type="radio" name={`${id}-scope`} value={s} checked={scope === s} onChange={() => setScope(s)} />
              <span>{s === "chapter" ? t("This chapter") : t("The book so far")}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {rows.length >= FILTER_FROM && (
        <div className="field">
          <label className="field-label" htmlFor={`${id}-find`}>
            {t("Find by name")}
          </label>
          <input id={`${id}-find`} className="field-input" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} autoComplete="off" />
        </div>
      )}
      <p className="visually-hidden" role="status">
        {t.plural(shown.length, { one: "{count} entry", other: "{count} entries" })}
      </p>
      {shown.length === 0 ? (
        <p className="goal-hint">{wanted ? t("Nothing by that name so far.") : t("Nothing here is named in this chapter.")}</p>
      ) : (
        <ul className="character-list xray-list" role="list">
          {shown.map((row) => (
            <XRayEntry key={row.name} book={book} row={row} pages={pages} chapterIndex={chapterIndex} scope={scope} onGo={onGo} />
          ))}
        </ul>
      )}
    </>
  );
}

function XRayEntry({ book, row, pages, chapterIndex, scope, onGo }: { book: Book; row: XRayRow; pages: ReaderPage[]; chapterIndex: number; scope: XRayScope; onGo?: (index: number) => void }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const stops = mentionStops(row, pages, chapterIndex, scope);
  const most = Math.max(1, ...stops.map((s) => s.count));
  const named = stops.filter((s) => s.index !== null);
  const listed = all ? named : named.slice(0, STOPS_SHOWN);
  const placeLabel = (at: number) => (scope === "sofar" ? t("Chapter {n}", { n: at + 1 }) : t("Page {n}", { n: at + 1 }));
  return (
    <li>
      <strong>{row.name}</strong>
      {row.description && <p>{row.description}</p>}
      <small>
        {row.kind === "people" ? t("First met in chapter {chapter}", { chapter: row.firstMet }) : t("First named in chapter {chapter}", { chapter: row.firstMet })}
        {" · "}
        {row.total > 0 ? t.plural(row.total, { one: "{count} mention", other: "{count} mentions" }) : t("No exact mentions found so far.")}
      </small>
      {row.total > 0 && (
        <>
          {/* How the mentions spread through the chapters (or the chapter's pages): a picture of the list below. */}
          <div className="xray-bar" aria-hidden="true">
            {stops.map((s) => (
              <span key={s.at} style={{ "--level": s.count / most } as CSSProperties} data-on={s.count > 0 || undefined} />
            ))}
          </div>
          <ul className="xray-stops" role="list">
            {listed.map((s) => {
              const label = (
                <>
                  {placeLabel(s.at)}
                  <span aria-hidden="true">· {s.count}</span>
                  <span className="visually-hidden">, {t.plural(s.count, { one: "{count} mention", other: "{count} mentions" })}</span>
                </>
              );
              const target = pages[s.index!];
              return (
                <li key={s.at}>
                  {onGo ? (
                    <button type="button" className="xray-stop" onClick={() => onGo(s.index!)}>
                      {label}
                    </button>
                  ) : (
                    <Link className="xray-stop" to={`/read/${book.id}?chapter=${target.chapterIndex}&page=${target.page}`}>
                      {label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {named.length > STOPS_SHOWN && (
            <button type="button" className="text-button xray-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? t("Show less") : t("Show all {n}", { n: named.length })}
            </button>
          )}
        </>
      )}
    </li>
  );
}
