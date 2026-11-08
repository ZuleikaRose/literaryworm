import { useEffect, useId, useState } from "react";
import { CLIP_LENGTHS, type ClipLength, clipAt, clipPath, clipTime } from "../lib/clips";
import { bookText, resolveNarration } from "../lib/narration";
import { chapterPieces, defaultNaturalVoice } from "../lib/naturalVoice";
import { uploadClipAt, uploadClipPath } from "../lib/uploadClips";
import { usePlayerSettings } from "../lib/usePlayerSettings";
import { useProfileData } from "../store/context";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";
import { useNaturalVoice } from "../lib/useNaturalVoice";

/**
 * *Share a clip* in the player and the mini-player (lib/clips.ts): the last 15, 30 or 60 seconds
 * of a LibriVox recording as a link anyone can play, of an upload's natural voice as a link only
 * the household can play, or of a classic's natural voice (when that's what's reading) as a link
 * members can play (lib/uploadClips.ts). Nothing is recorded or uploaded.
 */
export function ClipDialog({
  open,
  book,
  chapterIndex,
  offset,
  chapterSeconds,
  onClose,
}: {
  open: boolean;
  book: Book;
  chapterIndex: number;
  offset: number;
  /** How long the chapter is in the player (for uploads, where the place is a share of it). */
  chapterSeconds: number;
  onClose: () => void;
}) {
  const t = useT();
  const [length, setLength] = useState<ClipLength>(30);
  const [status, setStatus] = useState("");
  const name = useId();
  const { narrationVoice } = useProfileData();
  const { player } = usePlayerSettings(book.id);
  const [chapters, setChapters] = useState<string[] | null>(null);
  const isUpload = Boolean(book.upload) && !book.recording;
  // A classic read by a natural voice shares that voice (members), not the LibriVox recording.
  const naturalSource = useNaturalVoice(book);
  const reading = resolveNarration(book, narrationVoice, [], naturalSource !== null);
  const classicNatural = !isUpload && Boolean(book.publicDomain && book.recording) && naturalSource === "member" && reading.kind === "natural";
  const naturalClip = isUpload || classicNatural;
  useEffect(() => {
    if (!naturalClip) return;
    let live = true;
    bookText(book).then(
      (text) => live && setChapters(text),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [book, naturalClip]);

  const track = book.recording?.tracks[chapterIndex];
  let path: string | null = null;
  let span: { start: number; end: number } | null = null;
  if (naturalClip) {
    if (chapters) {
      const narrator = reading.kind === "natural" ? reading.voice : defaultNaturalVoice(book.language);
      const pieces = chapterPieces(chapters[chapterIndex] ?? "", narrator, player.characterVoices);
      const clip = uploadClipAt(chapterIndex, chapterSeconds > 0 ? offset / chapterSeconds : 0, pieces, length, narrator.id, player.characterVoices);
      if (clip) path = uploadClipPath(book.id, clip);
    }
  } else if (track) {
    const clip = clipAt(chapterIndex, offset, length, track.seconds);
    path = clipPath(book.id, clip);
    span = clip;
  }
  if (!track && !naturalClip) return null;
  const url = path ? `${window.location.origin}${path}` : "";
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
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Share a clip")}
      description={
        <p>
          {isUpload
            ? t("A link that plays a short stretch of this book in its natural voice. Only your household can play it, logged in to this account.")
            : classicNatural
              ? t("A link that plays a short stretch of this classic in the natural voice you're hearing. LiteraryWorm members can play it, logged in. To share it with anyone, choose the LibriVox recording under Voice first.")
              : t("A link that plays a short stretch of this LibriVox recording, which is in the public domain.")}
        </p>
      }
    >
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
      {span && (
        <p className="goal-hint">
          {t("{chapter}, {start} to {end}", { chapter, start: clipTime(span.start), end: clipTime(span.end) })}
        </p>
      )}
      {naturalClip && <p className="goal-hint">{path ? t("{chapter}, the part you're listening to", { chapter }) : t("Loading the narration…")}</p>}
      <input className="field-input" readOnly value={url} aria-label={t("Clip link")} onFocus={(e) => e.currentTarget.select()} />
      <div className="modal-actions">
        {typeof navigator.share === "function" && (
          <button type="button" className="primary-button" onClick={share} disabled={!path}>
            <Icon name="share" size={17} /> {t("Share")}
          </button>
        )}
        <button type="button" className="secondary-button" onClick={copy} disabled={!path}>
          {t("Copy link")}
        </button>
        <a className="text-button" href={path ?? "#"} target="_blank" rel="noreferrer">
          {t("Open the clip")} <Icon name="external" size={15} />
        </a>
      </div>
      <p className="visually-hidden" role="status">
        {status}
      </p>
    </Dialog>
  );
}
