import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { usesBackend } from "../lib/backend";
import { fetchBookPage } from "../lib/booksApi";
import {
  catalogMatch,
  IMPORT_MAX_BYTES,
  type ImportFile,
  type ImportRow,
  pickMatch,
  readImport,
  searchTitle,
  SOURCE_NAMES,
  STATUS_LABEL,
} from "../lib/importCsv";
import { useCollections } from "../lib/useCollections";
import { useLibrary } from "../lib/useLibrary";
import type { Profile } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";

/** Google Books searches go through the books function, which allows 60 a minute: stay under it. */
const SEARCH_GAP_MS = 1100;

interface Match {
  row: ImportRow;
  bookId: string;
  title: string;
  authors: string[];
  cover: string | null;
  from: "LiteraryWorm" | "Google Books";
}

type Step =
  | { name: "choose" }
  | { name: "matching"; file: ImportFile; checked: number }
  | { name: "review"; file: ImportFile; matches: Match[]; missing: ImportRow[]; stopped: boolean }
  | { name: "adding"; total: number; done: number }
  | { name: "done"; added: number; failed: string[] };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * My Library → Import: a Goodreads or StoryGraph export, read on the device. Each book is
 * matched to a LiteraryWorm title, or found on Google Books by its title (through the books
 * function) and accepted only when the author agrees; the reader reviews the matches, then they
 * join the library with their shelf as the status and their stars as a rating. Books marked
 * read are added as Finished without counting towards today's goal.
 */
export function ImportDialog({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("Import your reading")} eyebrow={t("Goodreads or StoryGraph")}>
      {open && <Importer profile={profile} onClose={onClose} />}
    </Dialog>
  );
}

function Importer({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const t = useT();
  const library = useLibrary();
  const collections = useCollections();
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [file, setFile] = useState<ImportFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const stopRef = useRef(false);
  const liveRef = useRef(true);
  const id = useId();

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      stopRef.current = true;
    };
  }, []);

  const inLibrary = (bookId: string) => Boolean(library.entries[bookId]);

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    setFile(null);
    setFileError(null);
    if (!picked) return;
    if (picked.size > IMPORT_MAX_BYTES) {
      setFileError(t("That file is over 5 MB. Choose the CSV export, not a backup or a spreadsheet."));
      return;
    }
    try {
      setFile(readImport(await picked.text()));
    } catch (err) {
      setFileError(err instanceof Error ? err.message : t("We couldn't read that file."));
    }
  }

  async function findBooks(source: ImportFile) {
    stopRef.current = false;
    setStep({ name: "matching", file: source, checked: 0 });
    const matches: Match[] = [];
    const missing: ImportRow[] = [];
    let failures = 0;
    let searched = false;
    for (const [i, row] of source.rows.entries()) {
      if (stopRef.current) break;
      const local = catalogMatch(row, profile.ageRating);
      if (local) {
        matches.push({ row, bookId: local.id, title: local.title, authors: [local.author], cover: null, from: "LiteraryWorm" });
      } else {
        const q = searchTitle(row.title);
        // Kids profiles see only the catalog; without the backend there's nothing else to search.
        if (!q || !usesBackend || profile.ageRating === "kids" || failures >= 3) {
          missing.push(row);
        } else {
          if (searched) await wait(SEARCH_GAP_MS);
          searched = true;
          try {
            const page = await fetchBookPage({ mode: "search", q }, 0, profile.ageRating);
            const found = pickMatch(row, page.items);
            failures = 0;
            if (found) matches.push({ row, bookId: found.id, title: found.title, authors: found.authors, cover: found.cover, from: "Google Books" });
            else missing.push(row);
          } catch (err) {
            failures += 1;
            console.error("import: a search failed:", err instanceof Error ? err.message : err);
            missing.push(row);
          }
        }
      }
      if (!liveRef.current) return;
      setStep({ name: "matching", file: source, checked: i + 1 });
    }
    if (!liveRef.current) return;
    // The same book twice (two editions, or listed twice) is added once.
    const unique = matches.filter((m, i) => matches.findIndex((x) => x.bookId === m.bookId) === i);
    setChosen(new Set(unique.flatMap((m, i) => (inLibrary(m.bookId) ? [] : [i]))));
    setStep({ name: "review", file: source, matches: unique, missing, stopped: stopRef.current });
  }

  async function addBooks(matches: Match[]) {
    const picked = matches.filter((_, i) => chosen.has(i));
    setStep({ name: "adding", total: picked.length, done: 0 });
    const failed: string[] = [];
    let added = 0;
    for (const m of picked) {
      try {
        await library.add({ bookId: m.bookId, title: m.title, authors: m.authors, cover: m.cover }, m.row.status, { countFinished: false });
        added += 1;
        if (m.row.rating) await collections.rate(m.bookId, m.row.rating);
      } catch (err) {
        failed.push(`${m.title}: ${err instanceof Error ? err.message : t("couldn't be added")}`);
      }
      if (!liveRef.current) return;
      setStep({ name: "adding", total: picked.length, done: added + failed.length });
    }
    setStep({ name: "done", added, failed });
  }

  if (step.name === "choose") {
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    return (
      <div className="import">
        <p className="goal-hint" id={hintId}>
          {t("On Goodreads: My Books → Import and export → Export library. On StoryGraph: Manage account → Export StoryGraph library. The file stays on this device; only book titles are looked up.")}
        </p>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-file`}>
            {t("Your export (CSV)")}
          </label>
          <input
            id={`${id}-file`}
            className="field-input"
            type="file"
            accept=".csv,text/csv"
            onChange={choose}
            aria-describedby={fileError ? `${hintId} ${errorId}` : hintId}
          />
        </div>
        {fileError && (
          <p className="field-error" id={errorId} role="alert">
            <Icon name="alert" size={15} /> {fileError}
          </p>
        )}
        {file && (
          <p className="form-success" role="status">
            <Icon name="check" size={17} />{" "}
            {file.skipped > 0
              ? t.plural(
                  file.rows.length,
                  { one: "{source} export: {count} book ({skipped} left out: not finished or without a title).", other: "{source} export: {count} books ({skipped} left out: not finished or without a title)." },
                  { source: SOURCE_NAMES[file.source], skipped: file.skipped },
                )
              : t.plural(file.rows.length, { one: "{source} export: {count} book.", other: "{source} export: {count} books." }, { source: SOURCE_NAMES[file.source] })}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="primary-button" disabled={!file || file.rows.length === 0} onClick={() => file && findBooks(file)}>
            {t("Find these books")}
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("Cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (step.name === "matching") {
    const total = step.file.rows.length;
    return (
      <div className="import">
        <p role="status">
          {t("Finding your books: {checked} of {total} checked.", { checked: step.checked, total })}
        </p>
        <progress className="goal-bar" max={total} value={step.checked} aria-label={t("{checked} of {total} books checked", { checked: step.checked, total })} />
        <p className="goal-hint">{t("LiteraryWorm titles are found at once; others are looked up on Google Books about one a second.")}</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={() => (stopRef.current = true)}>
            {t("Stop and review what's found")}
          </button>
        </div>
      </div>
    );
  }

  if (step.name === "review") {
    const count = chosen.size;
    const toggle = (i: number) =>
      setChosen((set) => {
        const next = new Set(set);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
    return (
      <div className="import">
        <p role="status">
          {step.stopped
            ? t.plural(
                step.file.rows.length,
                { one: "Found {found} of {count} book before you stopped. Untick any that aren't right.", other: "Found {found} of {count} books before you stopped. Untick any that aren't right." },
                { found: step.matches.length },
              )
            : t.plural(
                step.file.rows.length,
                { one: "Found {found} of {count} book. Untick any that aren't right.", other: "Found {found} of {count} books. Untick any that aren't right." },
                { found: step.matches.length },
              )}
        </p>
        {step.matches.length > 0 && (
          <ul className="import-list" role="list">
            {step.matches.map((m, i) => {
              const have = inLibrary(m.bookId);
              return (
                <li key={`${m.bookId}-${m.row.line}`}>
                  <label className="check-row">
                    <input type="checkbox" checked={chosen.has(i)} disabled={have} onChange={() => toggle(i)} />
                    <span>
                      <strong>{m.title}</strong>
                      <small>
                        {m.authors[0] ?? m.row.author} · {m.from} · {t(STATUS_LABEL[m.row.status])}
                        {m.row.rating && ` · ${{ love: t("Love it"), like: t("Like it"), "not-for-me": t("Not for me") }[m.row.rating]}`}
                        {have && ` · ${t("Already in your library")}`}
                      </small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {step.missing.length > 0 && (
          <details className="import-missing">
            <summary>{t("Not found ({n})", { n: step.missing.length })}</summary>
            <ul role="list">
              {step.missing.map((r) => (
                <li key={r.line}>
                  {r.title}
                  {r.author && <small> · {r.author}</small>}
                </li>
              ))}
            </ul>
            <p className="goal-hint">{t("Search for these by title and add them from their pages.")}</p>
          </details>
        )}
        <div className="modal-actions">
          <button type="button" className="primary-button" disabled={count === 0} onClick={() => addBooks(step.matches)}>
            {t.plural(count, { one: "Add {count} book", other: "Add {count} books" })}
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("Cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (step.name === "adding") {
    return (
      <div className="import">
        <p role="status">
          {t("Adding to your library: {done} of {total}.", { done: step.done, total: step.total })}
        </p>
        <progress className="goal-bar" max={step.total} value={step.done} aria-label={t("{done} of {total} books added", { done: step.done, total: step.total })} />
      </div>
    );
  }

  return (
    <div className="import">
      <p className="form-success" role="status">
        <Icon name="check" size={17} /> {t.plural(step.added, { one: "Added {count} book to your library.", other: "Added {count} books to your library." })}
      </p>
      {step.failed.length > 0 && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <div>
            <p>
              {t.plural(step.failed.length, { one: "{count} book couldn't be added:", other: "{count} books couldn't be added:" })}
            </p>
            <ul>
              {step.failed.slice(0, 10).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <p className="goal-hint">{t("Books you'd read are in Finished, without counting towards this year's goal or stats, since they were read before.")}</p>
      <div className="modal-actions">
        <button type="button" className="primary-button" onClick={onClose}>
          {t("Done")}
        </button>
      </div>
    </div>
  );
}
