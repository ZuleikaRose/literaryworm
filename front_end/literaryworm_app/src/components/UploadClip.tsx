import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DEMO_NATURAL_SAMPLES } from "../data/demoUploads";
import { getBook } from "../data/books";
import { clipTime } from "../lib/clips";
import { demoVoicePart } from "../lib/demoVoices";
import { bookText } from "../lib/narration";
import { naturalVoice } from "../lib/naturalVoice";
import { memberVoicePart } from "../lib/naturalVoiceOffline";
import { readUploadClip, uploadClipWindow } from "../lib/uploadClips";
import { uploadToBook } from "../lib/uploads";
import { usePlayerSettings } from "../lib/usePlayerSettings";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { useActiveProfile, useStore } from "../store/context";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

/**
 * A clip from an uploaded book (lib/uploadClips.ts), for the household it belongs to: the part's
 * natural-voice audio, asked for like the player asks (the natural-voice function answers only the
 * account that owns the upload; the demo plays its recordings), stopped at the clip's end. A classic's
 * natural-voice clip (an id that isn't an upload's, with a voice in the address) plays the same way
 * for any member: its parts are the book's own words, kept for everyone.
 */
export function UploadClip({ uploadId }: { uploadId: string }) {
  const t = useT();
  const [params] = useSearchParams();
  const clip = readUploadClip(params);
  const { state } = useStore();
  const profile = useActiveProfile();
  // Any profile in the household can play it, so look through every profile's uploads.
  const upload = Object.values(state.profileData)
    .flatMap((d) => d.uploads ?? [])
    .find((u) => u.id === uploadId);
  const classic = !uploadId.startsWith("u-");
  const book = useMemo(() => {
    if (upload) return uploadToBook(upload);
    const found = classic ? getBook(uploadId) : undefined;
    return found?.publicDomain && found.recording ? found : undefined;
  }, [upload, classic, uploadId]);
  const { player } = usePlayerSettings(uploadId);
  const choicesRef = useRef(player.castChoices?.[uploadId] ?? {});
  const pronRef = useRef(player.pronunciations?.[uploadId] ?? {});
  const demo = Boolean(state.account?.isDemo);
  const voice = clip ? naturalVoice(clip.voice) : null;
  const problem = !state.account
    ? "signin"
    : demo && classic && book
      ? "demo-classic"
      : !book || !clip || !voice || (demo && !DEMO_NATURAL_SAMPLES.includes(uploadId)) || (classic && !profile)
        ? "missing"
        : profile?.ageRating === "kids"
          ? "kids"
          : null;
  useTitle(book && !problem ? t("A clip from {title}", { title: book.title }) : t("Clip not found"));

  const audio = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [span, setSpan] = useState<{ start: number; end: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (problem || !book || !clip || !voice) return;
    let live = true;
    bookText(book)
      .then((chapters) => {
        const part = demo
          ? demoVoicePart(uploadId, voice, chapters, clip.cast, choicesRef.current)
          : memberVoicePart(uploadId, voice, chapters, clip.cast, choicesRef.current, pronRef.current, classic ? (profile?.id ?? null) : null);
        if (clip.chapter >= chapters.length || clip.piece >= part.pieces(chapters[clip.chapter]).length) throw new Error(t("This clip's link is incomplete or no longer works."));
        return part.url(clip.chapter, clip.piece);
      })
      .then(
        (url) => live && setSrc(url),
        (err: unknown) => live && setError(err instanceof Error ? err.message : t("We couldn't play the clip. Check your connection and try again.")),
      );
    return () => {
      live = false;
    };
    // The clip's address decides it; settings are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, book, params.toString(), demo, uploadId]);

  useEffect(() => {
    const el = audio.current;
    if (!el || !clip || !src) return;
    const onMeta = () => setSpan(uploadClipWindow(clip.at, clip.length, el.duration || 0));
    const onTime = () => {
      if (!span) return;
      if (el.currentTime >= span.end) {
        el.pause();
        el.currentTime = span.start;
        setAt(0);
        return;
      }
      setAt(Math.max(0, el.currentTime - span.start));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    if (el.readyState >= 1 && !span) onMeta();
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [clip, src, span]);

  if (problem) {
    return (
      <section className="clip-page">
        <h1>{problem === "missing" ? t("Clip not found") : classic && book ? t("A clip from {title}", { title: book.title }) : t("A clip from an uploaded book")}</h1>
        <p>
          {problem === "signin"
            ? classic
              ? t("This clip is in a natural voice from Google, which LiteraryWorm members can play. Log in to listen.")
              : t("This clip is from a book someone uploaded, so only their household can play it. Log in to that account to listen.")
            : problem === "demo-classic"
              ? t("The demo plays the classics in their LibriVox recordings, so it can't play this natural-voice clip. Members can.")
              : problem === "kids"
                ? t("Clips in natural voices aren't offered on Kids profiles.")
                : t("This clip's link is incomplete, or it's from a book in another household. Clips from uploads play only for the household that uploaded the book.")}
        </p>
        {problem === "demo-classic" && book && (
          <Link className="secondary-button" to={`/listen/${book.id}`}>
            {t("Listen to {title}", { title: book.title })}
          </Link>
        )}
        <Link className="primary-button" to={problem === "signin" ? "/signin" : "/"}>
          {problem === "signin" ? t("Log in") : t("Go to LiteraryWorm")}
        </Link>
      </section>
    );
  }

  const chapter = book!.chapters[clip!.chapter]?.title ?? t("Chapter {n}", { n: clip!.chapter + 1 });

  function toggle() {
    const el = audio.current;
    if (!el || !span) return;
    if (!el.paused) return el.pause();
    if (el.currentTime < span.start || el.currentTime >= span.end) el.currentTime = span.start;
    setError(null);
    el.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(t("We couldn't play the clip. Check your connection and try again."));
    });
  }

  return (
    <section className="clip-page" aria-labelledby="clip-title">
      <Cover book={book!} size="md" />
      <div className="clip-info">
        <p className="eyebrow">{classic ? t("A clip in a natural voice") : t("A clip from an uploaded book")}</p>
        <h1 id="clip-title">{book!.title}</h1>
        {book!.author && <p className="byline">{t("by {author}", { author: book!.author })}</p>}
        <p>{span ? t("{chapter}, {start} to {end} of a part", { chapter, start: clipTime(span.start), end: clipTime(span.end) }) : chapter}</p>
        {src && <audio ref={audio} src={src} preload="metadata" />}
        <div className="clip-controls">
          <button type="button" className="primary-button" onClick={toggle} aria-pressed={playing} disabled={!span}>
            <Icon name={playing ? "pause" : "play"} size={18} filled /> {playing ? t("Pause") : t("Play clip")}
          </button>
          {span && (
            <span aria-live="off">
              {clipTime(at)} / {clipTime(span.end - span.start)}
            </span>
          )}
        </div>
        {!src && !error && (
          <p className="goal-hint" role="status">
            {t("Loading the narration…")}
          </p>
        )}
        {error && (
          <p className="form-alert" role="alert">
            <Icon name="alert" size={17} /> {error}
          </p>
        )}
        <p className="privacy-note">{classic
            ? t("Read by {voice}, a natural voice from Google, from the book's public-domain text. Clips in natural voices play for LiteraryWorm members.", { voice: voice!.name })
            : t("Read by {voice}, a natural voice from Google. Clips from uploads play only for your household.", { voice: voice!.name })}</p>
        <Link className="secondary-button" to={`/books/${uploadId}`}>
          {t("See the book")}
        </Link>
      </div>
    </section>
  );
}
