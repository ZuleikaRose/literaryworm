import { useId, useState } from "react";
import { CLIP_LENGTHS, type ClipLength, clipAt, clipPath, clipTime } from "../lib/clips";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";

/**
 * *Share a clip* in the player and the mini-player (lib/clips.ts): the last 15, 30 or 60 seconds
 * of a LibriVox recording as a link anyone can play. Nothing is recorded or uploaded.
 */
export function ClipDialog({ open, book, chapterIndex, offset, onClose }: { open: boolean; book: Book; chapterIndex: number; offset: number; onClose: () => void }) {
  const t = useT();
  const [length, setLength] = useState<ClipLength>(30);
  const [status, setStatus] = useState("");
  const name = useId();
  const track = book.recording?.tracks[chapterIndex];
  if (!track) return null;
  const clip = clipAt(chapterIndex, offset, length, track.seconds);
  const url = `${window.location.origin}${clipPath(book.id, clip)}`;
  const chapter = book.chapters[chapterIndex]?.title ?? t("Chapter {n}", { n: chapterIndex + 1 });
  const text = t("{title} by {author}, {chapter}", { title: book.title, author: book.author, chapter });

  async function share() {
    try {
      await navigator.share({ title: book.title, text, url });
      setStatus(t("Shared."));
    } catch (err) {
      if ((err as Error).name !== "AbortError") setStatus(t("We couldn't open sharing. Copy the link instead."));
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(t("Link copied."));
    } catch {
      setStatus(t("We couldn't copy it. Select the link and copy it instead."));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("Share a clip")} description={<p>{t("A link that plays a short stretch of this LibriVox recording, which is in the public domain.")}</p>}>
      <fieldset className="mood-group">
        <legend>{t("Length")}</legend>
        <div className="taste-row">
          {CLIP_LENGTHS.map((l) => (
            <label key={l} className="chip">
              <input type="radio" name={name} checked={length === l} onChange={() => setLength(l)} />
              <span>{t("{n} seconds", { n: l })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="goal-hint">
        {t("{chapter}, {start} to {end}", { chapter, start: clipTime(clip.start), end: clipTime(clip.end) })}
      </p>
      <input className="field-input" readOnly value={url} aria-label={t("Clip link")} onFocus={(e) => e.currentTarget.select()} />
      <div className="modal-actions">
        {typeof navigator.share === "function" && (
          <button type="button" className="primary-button" onClick={share}>
            <Icon name="share" size={17} /> {t("Share")}
          </button>
        )}
        <button type="button" className="secondary-button" onClick={copy}>
          {t("Copy link")}
        </button>
        <a className="text-button" href={clipPath(book.id, clip)} target="_blank" rel="noreferrer">
          {t("Open the clip")} <Icon name="external" size={15} />
        </a>
      </div>
      <p className="visually-hidden" role="status">
        {status}
      </p>
    </Dialog>
  );
}
