import { type FormEvent, useId, useRef, useState } from "react";
import { LEGAL_HEADING_MAX, LEGAL_SECTIONS_MAX, LEGAL_SUMMARY_MAX, LEGAL_TITLE_MAX, type LegalPage, type LegalSection } from "../data/legal";
import { saveLegalPage } from "../lib/legalApi";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/** A section as it's edited: the paragraphs as one text, split on blank lines. */
type Draft = { key: string; heading: string; text: string };

const PARAGRAPH_MAX = 5000;
const toDraft = (s: LegalSection): Draft => ({ key: crypto.randomUUID(), heading: s.heading, text: s.paragraphs.join("\n\n") });
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/**
 * Edits a legal page in place (editors and admins): its title, summary and sections. Each
 * section is a heading and its text, with a blank line between paragraphs. Saving replaces the
 * live page at once; the database keeps the version it replaced.
 */
export function LegalEditor({ page, onSaved, onCancel }: { page: LegalPage; onSaved: (page: LegalPage) => void; onCancel: () => void }) {
  const t = useT();
  const [title, setTitle] = useState(page.title);
  const [summary, setSummary] = useState(page.summary);
  const [sections, setSections] = useState<Draft[]>(() => (page.sections ?? []).map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const id = useId();

  const change = (key: string, patch: Partial<Draft>) => setSections((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (index: number, by: number) =>
    setSections((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  /** The first thing that stops the page saving, in words, or null. */
  const problem = (): string | null => {
    if (!title.trim() || title.trim().length > LEGAL_TITLE_MAX) return t("The title needs 1 to {max} characters.", { max: LEGAL_TITLE_MAX });
    if (!summary.trim() || summary.trim().length > LEGAL_SUMMARY_MAX) return t("The summary needs 1 to {max} characters.", { max: LEGAL_SUMMARY_MAX });
    if (sections.length > LEGAL_SECTIONS_MAX) return t("A page can have up to {max} sections.", { max: LEGAL_SECTIONS_MAX });
    for (const [i, s] of sections.entries()) {
      if (!s.heading.trim() || s.heading.trim().length > LEGAL_HEADING_MAX) return t("Section {n} needs a heading of 1 to {max} characters.", { n: i + 1, max: LEGAL_HEADING_MAX });
      const paras = paragraphs(s.text);
      if (!paras.length) return t("Section {n} (\"{heading}\") needs some text.", { n: i + 1, heading: s.heading.trim() });
      if (paras.some((p) => p.length > PARAGRAPH_MAX)) return t("A paragraph in section {n} is over {max} characters. Split it with a blank line.", { n: i + 1, max: PARAGRAPH_MAX });
    }
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = problem();
    if (found) {
      setError(found);
      errorRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveLegalPage(page.slug, {
        title,
        summary,
        sections: sections.map((s) => ({ heading: s.heading.trim(), paragraphs: paragraphs(s.text) })),
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't save the page. Try again."));
      errorRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="legal-editor" onSubmit={submit} noValidate aria-describedby={error ? `${id}-error` : undefined}>
      <p className="goal-hint">
        {t("Changes go live as soon as you save. Separate paragraphs with a blank line. Earlier versions are kept.")}
      </p>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-title`}>
          {t("Title")}
        </label>
        <input id={`${id}-title`} className="field-input" value={title} maxLength={LEGAL_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-summary`}>
          {t("Summary")}
        </label>
        <textarea id={`${id}-summary`} className="field-input" rows={3} value={summary} maxLength={LEGAL_SUMMARY_MAX} onChange={(e) => setSummary(e.target.value)} />
      </div>

      <ol className="legal-editor-sections">
        {sections.map((s, i) => (
          <li key={s.key} className="legal-editor-section">
            <div className="field">
              <label className="field-label" htmlFor={`${id}-${s.key}-h`}>
                {t("Section {n} heading", { n: i + 1 })}
              </label>
              <input id={`${id}-${s.key}-h`} className="field-input" value={s.heading} maxLength={LEGAL_HEADING_MAX} onChange={(e) => change(s.key, { heading: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${id}-${s.key}-t`}>
                {t("Section {n} text", { n: i + 1 })}
              </label>
              <textarea id={`${id}-${s.key}-t`} className="field-input" rows={Math.min(14, Math.max(4, s.text.split("\n").length + 1))} value={s.text} onChange={(e) => change(s.key, { text: e.target.value })} />
            </div>
            <div className="goal-actions">
              <button type="button" className="ghost-button small-button" disabled={i === 0} onClick={() => move(i, -1)}>
                {t("Move up")}<span className="visually-hidden">{t(" section {n}", { n: i + 1 })}</span>
              </button>
              <button type="button" className="ghost-button small-button" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                {t("Move down")}<span className="visually-hidden">{t(" section {n}", { n: i + 1 })}</span>
              </button>
              <button type="button" className="ghost-button small-button danger-text" onClick={() => setSections((list) => list.filter((x) => x.key !== s.key))}>
                <Icon name="trash" size={15} /> {t("Remove")}<span className="visually-hidden">{t(" section {n}", { n: i + 1 })}</span>
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="secondary-button small-button"
        disabled={sections.length >= LEGAL_SECTIONS_MAX}
        onClick={() => setSections((list) => [...list, { key: crypto.randomUUID(), heading: "", text: "" }])}
      >
        <Icon name="plus" size={15} /> {t("Add a section")}
      </button>

      <p ref={errorRef} id={`${id}-error`} className="field-error" role="alert" tabIndex={-1} hidden={!error}>
        <Icon name="alert" size={15} /> {error}
      </p>
      <div className="modal-actions">
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? t("Saving…") : t("Save and publish")}
        </button>
        <button type="button" className="ghost-button" disabled={busy} onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
