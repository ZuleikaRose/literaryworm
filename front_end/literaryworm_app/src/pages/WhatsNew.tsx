import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { AccountError } from "../lib/accountApi";
import {
  BODY_MAX,
  builtInEntries,
  CHANGE_KINDS,
  type ChangeEntry,
  type ChangeFilter,
  type ChangeInput,
  dayLabel,
  entryError,
  filterEntries,
  groupReleases,
  kindLabel,
  releaseLabel,
  TITLE_MAX,
  versionFor,
} from "../lib/changelog";
import { addEntry, deleteEntry, loadChangelog, updateEntry } from "../lib/changelogApi";
import { today } from "../lib/reading";
import { hasRole } from "../lib/staff";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";

const FILTERS: { value: ChangeFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  ...CHANGE_KINDS.map((k) => ({ value: k.value as ChangeFilter, label: k.plural })),
];

const message = (err: unknown) => (err instanceof AccountError ? err.message : "Something went wrong. Try again.");

/**
 * /whats-new: every new feature, fix and update, newest first, grouped by release. Public. The
 * built-in copy shows at once and the live list replaces it once it loads. Editors, developers
 * and admins add, change and delete entries here.
 */
export default function WhatsNew() {
  useTitle("What's new");
  const { state } = useStore();
  const roles = useStaffRoles();
  const canEdit = hasRole(roles, "editor") || hasRole(roles, "developer");
  const [entries, setEntries] = useState<ChangeEntry[]>(builtInEntries);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const [editing, setEditing] = useState<ChangeEntry | "new" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const reload = () =>
    loadChangelog().then(
      (found) => {
        if (found) {
          setEntries(found);
          setLive(true);
        }
      },
      (err: Error) => console.error("whats new: couldn't load the live list, showing the built-in one:", err.message),
    );

  useEffect(() => {
    void reload();
  }, []);

  const releases = groupReleases(filterEntries(entries, filter));
  const done = async (text: string) => {
    setEditing(null);
    setAnnouncement(text);
    await reload();
    headingRef.current?.focus();
  };

  return (
    <article className="page whats-new">
      <h1 ref={headingRef} tabIndex={-1}>
        What's new
      </h1>
      <p className="legal-summary">
        Everything that's changed in LiteraryWorm, newest first.{" "}
        {state.account?.userId ? (
          <>
            Get the biggest changes by email once a month: turn it on in <Link to="/account#preferences">Account → Preferences</Link>.
          </>
        ) : (
          "Members can get the biggest changes by email once a month."
        )}
      </p>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      {canEdit && live && editing === null && (
        <div className="legal-edit-bar">
          <button type="button" className="secondary-button small-button" onClick={() => setEditing("new")}>
            <Icon name="plus" size={15} /> Add a change
          </button>
        </div>
      )}
      {editing === "new" && <EntryForm onCancel={() => setEditing(null)} onSaved={(e) => done(`Added ${e.title}.`)} />}

      <fieldset className="filter-group whats-new-filter">
        <legend>Show</legend>
        <div className="chip-group">
          {FILTERS.map((f) => (
            <label key={f.value} className="chip">
              <input type="radio" name="whats-new-filter" checked={filter === f.value} onChange={() => setFilter(f.value)} />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {releases.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        releases.map((r) => (
          <section key={r.version} className="release" aria-labelledby={`release-${r.version}`}>
            <h2 id={`release-${r.version}`}>
              {releaseLabel(r.releasedOn)} <span className="release-version">Version {r.version}</span>
            </h2>
            <ul className="release-entries" role="list">
              {r.entries.map((e) =>
                editing !== null && editing !== "new" && editing.id === e.id ? (
                  <li key={e.id ?? e.title}>
                    <EntryForm entry={e} onCancel={() => setEditing(null)} onSaved={(saved) => done(`Saved ${saved.title}.`)} onDeleted={() => done(`Deleted ${e.title}.`)} />
                  </li>
                ) : (
                  <li key={e.id ?? e.title} className="release-entry">
                    <p className="release-tags">
                      <span className={`release-kind kind-${e.kind}`}>{kindLabel(e.kind)}</span>
                      {e.major && <span className="release-major">Major</span>}
                      <span className="muted">{dayLabel(e.releasedOn)}</span>
                    </p>
                    <h3>{e.title}</h3>
                    <p>{e.body}</p>
                    {canEdit && e.id && editing === null && (
                      <button type="button" className="ghost-button small-button" onClick={() => setEditing(e)}>
                        <Icon name="edit" size={15} /> Edit<span className="visually-hidden"> {e.title}</span>
                      </button>
                    )}
                  </li>
                ),
              )}
            </ul>
          </section>
        ))
      )}
    </article>
  );
}

function EntryForm({
  entry,
  onCancel,
  onSaved,
  onDeleted,
}: {
  entry?: ChangeEntry;
  onCancel: () => void;
  onSaved: (e: ChangeEntry) => void;
  onDeleted?: () => void;
}) {
  const day = today();
  const [form, setForm] = useState<ChangeInput>(
    entry ?? { releasedOn: day, version: versionFor(day), kind: "feature", title: "", body: "", major: false },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => firstRef.current?.focus(), []);
  const set = (patch: Partial<ChangeInput>) => setForm((f) => ({ ...f, ...patch }));
  const describedBy = error ? errorId : undefined;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = entryError(form);
    if (problem) {
      setError(problem);
      return;
    }
    void run(async () => onSaved(entry?.id ? await updateEntry(entry.id, form) : await addEntry(form)));
  };

  return (
    <form className="goal-card entry-form" onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{entry ? "Edit the change" : "Add a change"}</h3>
      <div className="entry-form-row">
        <div className="field">
          <label className="field-label" htmlFor={`${id}-day`}>
            Released
          </label>
          <input
            ref={firstRef}
            id={`${id}-day`}
            className="field-input"
            type="date"
            value={form.releasedOn}
            onChange={(e) => set({ releasedOn: e.target.value, ...(entry ? {} : { version: versionFor(e.target.value || day) }) })}
            aria-describedby={describedBy}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-version`}>
            Version
          </label>
          <input id={`${id}-version`} className="field-input" value={form.version} onChange={(e) => set({ version: e.target.value })} aria-describedby={describedBy} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-kind`}>
            Kind
          </label>
          <select id={`${id}-kind`} className="field-input" value={form.kind} onChange={(e) => set({ kind: e.target.value as ChangeInput["kind"] })}>
            {CHANGE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-heading`}>
          Title
        </label>
        <input id={`${id}-heading`} className="field-input" maxLength={TITLE_MAX} value={form.title} onChange={(e) => set({ title: e.target.value })} aria-describedby={describedBy} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-body`}>
          What changed
        </label>
        <textarea id={`${id}-body`} className="field-input" rows={3} maxLength={BODY_MAX} value={form.body} onChange={(e) => set({ body: e.target.value })} aria-describedby={describedBy} />
      </div>
      <label className="check-row">
        <input type="checkbox" checked={form.major} onChange={(e) => set({ major: e.target.checked })} />
        <span>Major change: include it in the monthly email</span>
      </label>
      {error && (
        <p className="field-error" id={errorId} role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="goal-actions">
        <button type="submit" className="primary-button small-button" disabled={busy}>
          {busy ? "Saving…" : entry ? "Save" : "Publish"}
        </button>
        <button type="button" className="ghost-button small-button" onClick={onCancel}>
          Cancel
        </button>
        {entry?.id && onDeleted && (
          <button type="button" className="ghost-button small-button danger-text" disabled={busy} onClick={() => void run(async () => {
            await deleteEntry(entry.id!);
            onDeleted();
          })}>
            <Icon name="trash" size={15} /> Delete
          </button>
        )}
      </div>
    </form>
  );
}
