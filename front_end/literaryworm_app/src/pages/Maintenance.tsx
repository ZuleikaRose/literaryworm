import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { BackLink } from "../components/BackLink";
import { Dialog } from "../components/Dialog";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import {
  fromLocalInput,
  type MaintenanceNotice,
  NOTICE_MESSAGE_MAX,
  NOTICE_TITLE_MAX,
  type NoticeField,
  noticeErrors,
  noticeState,
  noticeWhen,
  sortForStaff,
  toLocalInput,
} from "../lib/maintenance";
import { addNotice, deleteNotice, loadAllNotices, updateNotice } from "../lib/maintenanceApi";
import { hasRole } from "../lib/staff";
import { useStaffRoles } from "../lib/useStaffRoles";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";

const H = 60 * 60 * 1000;
/** The time when a form is saved (read in the handler, not during render). */
const clock = () => Date.now();

/** A new notice's starting times: shown from now, for half an hour from 02:00 tomorrow. */
function freshTimes(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(2, 0, 0, 0);
  return { announceAt: now.getTime(), startsAt: start.getTime(), endsAt: start.getTime() + H / 2 };
}

interface Draft {
  title: string;
  message: string;
  announce: string;
  starts: string;
  ends: string;
}

const blank = (): Draft => {
  const t = freshTimes();
  return {
    title: "Planned update",
    message: "We're updating LiteraryWorm. You may be logged out briefly; your place in every book is saved.",
    announce: toLocalInput(t.announceAt),
    starts: toLocalInput(t.startsAt),
    ends: toLocalInput(t.endsAt),
  };
};

const fromNotice = (n: MaintenanceNotice): Draft => ({
  title: n.title,
  message: n.message,
  announce: toLocalInput(n.announceAt),
  starts: toLocalInput(n.startsAt),
  ends: toLocalInput(n.endsAt),
});

const STATE_LABEL = { scheduled: "Not showing yet", announced: "Showing", "under way": "Happening now", over: "Over" } as const;

/**
 * /maintenance, for developers and admins: the notices that show across the site before and during
 * planned work. Add, edit and delete them; the database checks the role (has_staff_role('developer')).
 */
export default function Maintenance() {
  useTitle("Maintenance notices");
  const roles = useStaffRoles();
  const isDemo = useStore().state.account?.isDemo ?? false;
  const allowed = hasRole(roles, "developer");

  return (
    <div className="page dashboard-page maintenance-page">
      <BackLink />
      <h1>Maintenance notices</h1>
      {allowed ? (
        <Notices />
      ) : (
        <p className="account-sub">
          {isDemo
            ? "The demo household has no staff access."
            : "Maintenance notices are for developers and admins. An admin can give you access in Account → Team access."}
        </p>
      )}
    </div>
  );
}

function Notices() {
  const [list, setList] = useState<MaintenanceNotice[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MaintenanceNotice | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [errors, setErrors] = useState<Partial<Record<NoticeField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MaintenanceNotice | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const formRef = useRef<HTMLHeadingElement>(null);
  const messageId = useId();

  useEffect(() => {
    let live = true;
    loadAllNotices().then(
      (value) => live && setList(value),
      (err: Error) => live && setLoadError(err.message),
    );
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      live = false;
      window.clearInterval(tick);
    };
  }, []);

  const set = (key: keyof Draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDone(null);
  };

  const parsed = {
    title: draft.title,
    message: draft.message,
    announceAt: fromLocalInput(draft.announce),
    startsAt: fromLocalInput(draft.starts),
    endsAt: fromLocalInput(draft.ends),
  };

  const startEdit = (n: MaintenanceNotice) => {
    setEditing(n);
    setDraft(fromNotice(n));
    setErrors({});
    setFormError(null);
    setDone(null);
    requestAnimationFrame(() => formRef.current?.focus());
  };

  const reset = () => {
    setEditing(null);
    setDraft(blank());
    setErrors({});
    setFormError(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const problems = noticeErrors(parsed, clock(), { isNew: editing === null });
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setFormError(null);
    try {
      const input = { title: parsed.title, message: parsed.message, announceAt: parsed.announceAt!, startsAt: parsed.startsAt!, endsAt: parsed.endsAt! };
      const saved = editing ? await updateNotice(editing.id, input) : await addNotice(input);
      setList((current) => [saved, ...(current ?? []).filter((n) => n.id !== saved.id)]);
      setDone(editing ? "Notice saved." : `Notice added. It shows from ${new Date(saved.announceAt).toLocaleString()}.`);
      reset();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "We couldn't save the notice. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const gone = removing;
    setRemoveError(null);
    try {
      await deleteNotice(gone.id);
      setList((current) => (current ?? []).filter((n) => n.id !== gone.id));
      if (editing?.id === gone.id) reset();
      setRemoving(null);
      setDone(`${gone.title} deleted.`);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "We couldn't delete the notice. Try again.");
    }
  };

  const preview = parsed.startsAt !== null && parsed.endsAt !== null && parsed.endsAt > parsed.startsAt ? noticeWhen({ startsAt: parsed.startsAt, endsAt: parsed.endsAt }) : null;

  return (
    <>
      <p className="account-sub">
        A notice shows as a banner at the top of every page, to visitors and members, from when it's announced until the work
        ends. Times are in your time zone; readers see them in theirs. Release to the dev site first, test it, then promote to
        the main site during the time you've announced.
      </p>

      <form className="support-form maintenance-form" noValidate onSubmit={save}>
        <h2 ref={formRef} tabIndex={-1}>
          {editing ? `Edit: ${editing.title}` : "New notice"}
        </h2>
        <Field label="Title" maxLength={NOTICE_TITLE_MAX} value={draft.title} onChange={(e) => set("title", e.target.value)} error={errors.title} />
        <div className="field">
          <label className="field-label" htmlFor={messageId}>
            Message
          </label>
          <textarea
            id={messageId}
            className="field-input"
            rows={3}
            maxLength={NOTICE_MESSAGE_MAX}
            value={draft.message}
            onChange={(e) => set("message", e.target.value)}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={`${messageId}-${errors.message ? "error" : "hint"}`}
          />
          {errors.message ? (
            <p className="field-error" id={`${messageId}-error`}>
              <Icon name="alert" size={15} />
              {errors.message}
            </p>
          ) : (
            <p className="field-hint" id={`${messageId}-hint`}>
              What will happen and what readers should expect. {draft.message.trim().length} of {NOTICE_MESSAGE_MAX} characters.
            </p>
          )}
        </div>
        <div className="maintenance-times">
          <Field label="Work starts" type="datetime-local" value={draft.starts} onChange={(e) => set("starts", e.target.value)} error={errors.startsAt} />
          <Field label="Work ends" type="datetime-local" value={draft.ends} onChange={(e) => set("ends", e.target.value)} error={errors.endsAt} hint="Up to 7 days after it starts." />
          <Field
            label="Show the notice from"
            type="datetime-local"
            value={draft.announce}
            onChange={(e) => set("announce", e.target.value)}
            error={errors.announceAt}
            hint="Up to 30 days before the work starts."
          />
        </div>
        {preview && (
          <div className="maintenance-preview">
            <p className="eyebrow">Preview</p>
            <div className="maintenance-notice">
              <Icon name="alert" size={18} />
              <p>
                <strong>{draft.title.trim() || "Title"}</strong> <span className="maintenance-when">{preview}.</span> {draft.message.trim()}
              </p>
            </div>
          </div>
        )}
        {formError && (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <p>{formError}</p>
          </div>
        )}
        <div className="modal-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save notice" : "Add notice"}
          </button>
          {editing && (
            <button type="button" className="secondary-button" onClick={reset}>
              Cancel editing
            </button>
          )}
        </div>
      </form>

      {done && (
        <div className="form-success" role="status">
          <Icon name="check" size={17} />
          <p>{done}</p>
        </div>
      )}

      <section className="maintenance-list" aria-labelledby="maintenance-all">
        <h2 id="maintenance-all">All notices</h2>
        {loadError && (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <p>{loadError}</p>
          </div>
        )}
        {list && list.length === 0 && <p className="account-sub">No notices yet.</p>}
        {list && list.length > 0 && (
          <ul>
            {sortForStaff(list, now).map((n) => {
              const state = noticeState(n, now);
              return (
                <li key={n.id} className={`maintenance-item is-${state.replace(" ", "-")}`}>
                  <div>
                    <p className="maintenance-item-head">
                      <strong>{n.title}</strong> <span className="maintenance-pill">{STATE_LABEL[state]}</span>
                    </p>
                    <p className="maintenance-when">{noticeWhen(n)}</p>
                    <p className="account-sub">{n.message}</p>
                    <p className="field-hint">Shows from {new Date(n.announceAt).toLocaleString()}</p>
                  </div>
                  <div className="maintenance-actions">
                    <button type="button" className="text-button" onClick={() => startEdit(n)}>
                      Edit<span className="visually-hidden"> {n.title}</span>
                    </button>
                    <button
                      type="button"
                      className="text-button danger-text"
                      onClick={() => {
                        setRemoveError(null);
                        setRemoving(n);
                      }}
                    >
                      Delete<span className="visually-hidden"> {n.title}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        size="sm"
        eyebrow="Maintenance notices"
        title={`Delete ${removing?.title ?? "notice"}?`}
        description={<p>{removing && noticeState(removing, now) !== "over" ? "It stops showing on the site straight away." : "It's removed from this list."}</p>}
      >
        {removeError && (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={17} />
            <p>{removeError}</p>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="danger-button" onClick={confirmRemove}>
            Delete
          </button>
          <button type="button" className="secondary-button" onClick={() => setRemoving(null)}>
            Keep it
          </button>
        </div>
      </Dialog>
    </>
  );
}
