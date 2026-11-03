import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { getBook } from "../data/books";
import { clipTime, readClip } from "../lib/clips";
import { ESSENTIAL } from "../lib/consent";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { rich } from "../lib/i18n";

/**
 * A shared audio clip (lib/clips.ts), public: a short stretch of a LibriVox recording, streamed
 * from the Internet Archive and stopped at the clip's end. Nothing about who shared it is kept.
 */
export default function ClipPage() {
  const { bookId = "" } = useParams();
  const [params] = useSearchParams();
  const book = getBook(bookId);
  const tracks = book?.recording?.tracks ?? [];
  const clip = book ? readClip(params, tracks.map((tr) => tr.seconds)) : null;
  const t = useT();
  useTitle(book && clip ? t("A clip from {title}", { title: book.title }) : t("Clip not found"));
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = audio.current;
    if (!el || !clip) return;
    const onTime = () => {
      if (el.currentTime >= clip.end) {
        el.pause();
        el.currentTime = clip.start;
        setAt(0);
        return;
      }
      setAt(Math.max(0, el.currentTime - clip.start));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [clip]);

  if (!book || !clip || !book.recording) {
    return (
      <section className="clip-page">
        <h1>{t("Clip not found")}</h1>
        <p>{t("This clip's link is incomplete or no longer works.")}</p>
        <Link className="primary-button" to="/">
          {t("Go to LiteraryWorm")}
        </Link>
      </section>
    );
  }

  const length = clip.end - clip.start;
  const track = tracks[clip.chapterIndex];
  const chapter = book.chapters[clip.chapterIndex]?.title ?? track.title;

  function toggle() {
    const el = audio.current;
    if (!el || !clip) return;
    if (!el.paused) return el.pause();
    if (el.currentTime < clip.start || el.currentTime >= clip.end) el.currentTime = clip.start;
    setError(null);
    el.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(t("We couldn't play the clip. Check your connection and try again."));
    });
  }

  return (
    <section className="clip-page" aria-labelledby="clip-title">
      <Cover book={book} size="md" />
      <div className="clip-info">
        <p className="eyebrow">{t("A clip from the audiobook")}</p>
        <h1 id="clip-title">{book.title}</h1>
        <p className="byline">{t("by {author}", { author: book.author })}</p>
        <p>
          {t("{chapter}, {start} to {end}", { chapter, start: clipTime(clip.start), end: clipTime(clip.end) })}
        </p>
        <audio ref={audio} {...ESSENTIAL} src={`${track.url}#t=${clip.start},${clip.end}`} preload="none" />
        <div className="clip-controls">
          <button type="button" className="primary-button" onClick={toggle} aria-pressed={playing}>
            <Icon name={playing ? "pause" : "play"} size={18} filled /> {playing ? t("Pause") : t("Play clip")}
          </button>
          <span aria-live="off">
            {clipTime(at)} / {clipTime(length)}
          </span>
        </div>
        {error && (
          <p className="form-alert" role="alert">
            <Icon name="alert" size={17} /> {error}
          </p>
        )}
        <p className="privacy-note">
          {rich(t("Read by {narrator} for {link}. This recording is in the public domain.", { narrator: book.recording.narrator }), {
            link: (
              <a href={book.recording.page} target="_blank" rel="noreferrer">
                LibriVox
              </a>
            ),
          })}
        </p>
        <Link className="secondary-button" to={`/books/${book.id}`}>
          {t("See the book")}
        </Link>
      </div>
    </section>
  );
}
